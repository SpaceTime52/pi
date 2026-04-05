/**
 * Thin pi-SDK wrapper for `/sub:isolate` and `/sub:main` slash commands.
 *
 * All argument parsing, agent resolution, continuation decisions, and
 * main-context wrapping live in `./sub-run-logic.ts` and are covered by
 * `__tests__/sub-run-logic.test.ts`. This file composes those decisions with
 * the pi ExtensionContext (ui.notify, ui.select, hasUI guards), spawns the
 * fire-and-forget subagent run via `runSingleAgent`/`enqueueSubagentInvocation`,
 * and forwards completion/error telemetry through `pi.sendMessage`.
 *
 * Coverage: this wrapper is EXCLUDED from `npm run test:subagent` coverage
 * because the remaining branching is pi runtime orchestration (tick interval,
 * widget updates, session origin switching, pi.sendMessage delivery paths) that
 * cannot be meaningfully exercised without a live pi runtime. The extracted
 * pure logic in `sub-run-logic.ts` is fully covered instead.
 */

import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { discoverAgents, getSubCommandAgentCompletions } from "../../agent/discovery.js";
import { RUN_OUTPUT_MESSAGE_MAX_CHARS, RUN_TICK_INTERVAL_MS } from "../../core/constants.js";
import type { SubagentDeps } from "../../core/deps.js";
import { getFinalOutput, getLastNonEmptyLine, updateRunFromResult } from "../../core/store.js";
import type { CommandRunState, SingleResult, SubagentDetails } from "../../core/types.js";
import {
  finalizeAndCleanup,
  getCurrentSessionFile as getSessionFileFromCtx,
  isInOriginSession,
  makePendingCompletion,
  registerRunLaunch,
} from "../../execution/orchestrator.js";
import { invokeWithAutoRetry, MAX_SUBAGENT_AUTO_RETRIES } from "../../execution/retry.js";
import { enqueueSubagentInvocation } from "../../execution/run.js";
import { runSingleAgent } from "../../execution/runner.js";
import { buildMainContextText, wrapTaskWithMainContext } from "../../session/context.js";
import { captureSwitchSession } from "../../session/navigation.js";
import { formatUsageStats, truncateLines } from "../../ui/format.js";
import { updateCommandRunsWidget } from "../../ui/widget.js";
import {
  buildResolvedDecisionFromAgent,
  buildRunContinuationCompletions,
  contextModeLabel,
  decideMainContextWrap,
  decideSubRun,
  formatAmbiguousAgentMessage,
  formatContinuationUnknownAgentMessage,
  LEGACY_MAIN_PREFIX_WARNING,
  mergeSubRunCompletions,
  NO_AGENTS_FOUND_MESSAGE,
  SUB_RUN_USAGE_TEXT,
  type SubRunDecision,
  sanitiseSessionFilePath,
  startedStateLabel,
} from "./sub-run-logic.js";

export function buildSubCommand(deps: SubagentDeps) {
  const { pi, store } = deps;

  return {
    description:
      "Run a subagent in a dedicated sub-session: /sub:isolate <agent|alias> <task>, /sub:isolate <runId> <task>, /sub:isolate <task> (defaults to worker)",
    getArgumentCompletions: (argumentPrefix: string) => {
      const discovery = discoverAgents(process.cwd());
      const agentItems = getSubCommandAgentCompletions(discovery.agents, argumentPrefix) ?? [];
      const runItems = buildRunContinuationCompletions(
        Array.from(store.commandRuns.values()),
        argumentPrefix,
      );
      return mergeSubRunCompletions(runItems, agentItems, argumentPrefix);
    },
    handler: async (args: string, ctx: ExtensionContext, forceMainContextFromWrapper = false) => {
      captureSwitchSession(store, ctx);
      let forceMainContext = forceMainContextFromWrapper;

      const discovery = discoverAgents(ctx.cwd);
      const agents = discovery.agents;

      const decision = decideSubRun(args, {
        agents,
        getRun: (id) => store.commandRuns.get(id),
      });

      // Handle decision outcomes that short-circuit the handler.
      if (decision.kind === "legacy-main-prefix") {
        ctx.ui.notify(LEGACY_MAIN_PREFIX_WARNING, "warning");
        return;
      }
      if (decision.kind === "empty-input") {
        ctx.ui.notify(SUB_RUN_USAGE_TEXT, "info");
        return;
      }
      if (decision.kind === "no-agents-found") {
        ctx.ui.notify(NO_AGENTS_FOUND_MESSAGE, "error");
        return;
      }
      if (decision.kind === "usage-missing-task") {
        ctx.ui.notify(SUB_RUN_USAGE_TEXT, "info");
        return;
      }
      if (decision.kind === "continuation-target-running") {
        ctx.ui.notify(`Subagent #${decision.targetRunId} is already running.`, "warning");
        return;
      }
      if (decision.kind === "continuation-target-unknown-agent") {
        ctx.ui.notify(
          formatContinuationUnknownAgentMessage(decision.targetRunId, decision.previousAgentName),
          "error",
        );
        return;
      }

      // Ambiguous agent — may require interactive selection.
      let finalDecision: Extract<SubRunDecision, { kind: "resolved" | "continuation" }>;
      if (decision.kind === "ambiguous-agent") {
        if (!decision.taskProvided) {
          ctx.ui.notify(
            formatAmbiguousAgentMessage(decision.firstToken, decision.ambiguousAgents, true),
            "error",
          );
          return;
        }
        // NOTE(user-approved): keep the current no-UI guidance behavior as-is.
        // (Improving the headless/RPC warning path is out of scope for this change.)
        if (!ctx.hasUI) {
          ctx.ui.notify(
            formatAmbiguousAgentMessage(decision.firstToken, decision.ambiguousAgents, false),
            "error",
          );
          return;
        }

        const selectedName = await ctx.ui.select(
          `Ambiguous alias "${decision.firstToken}" — choose subagent`,
          decision.ambiguousAgents.map((agent) => agent.name),
        );
        if (!selectedName) {
          ctx.ui.notify("Subagent selection cancelled.", "info");
          return;
        }
        const resolvedAgent = decision.ambiguousAgents.find((agent) => agent.name === selectedName);
        if (!resolvedAgent) {
          ctx.ui.notify("Could not resolve selected subagent.", "error");
          return;
        }
        const resolved = buildResolvedDecisionFromAgent(resolvedAgent.name, args);
        if (resolved.kind === "usage-missing-task") {
          ctx.ui.notify(SUB_RUN_USAGE_TEXT, "info");
          return;
        }
        finalDecision = resolved;
      } else {
        finalDecision = decision;
      }

      const selectedAgent = finalDecision.selectedAgent;
      const taskForDisplay = finalDecision.taskForDisplay;
      let taskForAgent = finalDecision.taskForAgent;
      const continuedFromRunId =
        finalDecision.kind === "continuation" ? finalDecision.targetRunId : undefined;

      let existingRunState: CommandRunState | undefined;

      if (continuedFromRunId !== undefined) {
        existingRunState = store.commandRuns.get(continuedFromRunId);
        if (!existingRunState) {
          ctx.ui.notify(`Unknown subagent run #${continuedFromRunId}.`, "error");
          return;
        }
        // NOTE(user-approved): on continuation, keep the existing context/session.
        // Mode switches between /sub:main and /sub:isolate are not applied retroactively to existing runs.
      } else if (forceMainContext) {
        // Extract main session context as text instead of copying the session file.
        // This prevents subagents from inheriting the main agent's persona.
        const subContextResult = buildMainContextText(ctx);
        const subContextText =
          typeof subContextResult === "string" ? subContextResult : subContextResult.text;
        const totalMessageCount =
          typeof subContextResult === "string" ? 0 : subContextResult.totalMessageCount;
        const rawMainSessionFile = ctx.sessionManager?.getSessionFile?.() ?? undefined;
        const mainSessionFile = sanitiseSessionFilePath(rawMainSessionFile);
        const wrapDecision = decideMainContextWrap({
          contextText: subContextText,
          totalMessageCount,
          mainSessionFile,
        });
        if (wrapDecision.apply) {
          taskForAgent = wrapTaskWithMainContext(taskForAgent, wrapDecision.contextText, {
            mainSessionFile: wrapDecision.mainSessionFile,
            totalMessageCount: wrapDecision.totalMessageCount,
          });
        } else {
          ctx.ui.notify(
            "Main session context is unavailable in this mode. Running with dedicated sub-session.",
            "warning",
          );
          forceMainContext = false;
        }
      }

      const originSessionFile = getSessionFileFromCtx(ctx);

      const runState = registerRunLaunch(store, ctx, {
        agent: selectedAgent,
        taskForDisplay,
        taskForAgent,
        inheritMainContext: forceMainContext,
        originSessionFile,
        continuedFromRunId,
        existingRunState,
        source: "command",
      });
      // Command-specific: reset retry tracking
      runState.retryCount = 0;
      runState.lastRetryReason = undefined;
      const runId = runState.id;
      const abortController = runState.abortController;
      if (!abortController) return;

      const makeDetails = (results: SingleResult[]): SubagentDetails => ({
        mode: "single",
        inheritMainContext: runState.contextMode === "main",
        projectAgentsDir: discovery.projectAgentsDir,
        results,
      });

      const contextLabel = contextModeLabel(runState.contextMode);
      const startedState = startedStateLabel(continuedFromRunId);

      pi.sendMessage(
        {
          customType: "subagent-command",
          content:
            `[subagent:${selectedAgent}#${runId}] ${startedState}` +
            `\nContext: ${contextLabel} · turn ${runState.turnCount}`,
          display: false,
          details: {
            runId,
            agent: selectedAgent,
            task: taskForDisplay,
            continuedFromRunId,
            turnCount: runState.turnCount,
            contextMode: runState.contextMode,
            sessionFile: runState.sessionFile,
            status: startedState,
            startedAt: runState.startedAt,
            elapsedMs: runState.elapsedMs,
            lastActivityAt: runState.lastActivityAt,
            thoughtText: runState.thoughtText,
          },
        },
        { deliverAs: "followUp", triggerTurn: false },
      );

      ctx.ui.notify(
        `${
          continuedFromRunId !== undefined
            ? `Resumed subagent #${runId}: ${selectedAgent}`
            : `Started subagent #${runId}: ${selectedAgent}`
        } (${contextLabel} · turn ${runState.turnCount})`,
        "info",
      );

      const tick = setInterval(() => {
        const current = store.commandRuns.get(runId);
        if (!current || current.status !== "running") {
          clearInterval(tick);
          return;
        }
        current.elapsedMs = Date.now() - current.startedAt;
        updateCommandRunsWidget(store);
      }, RUN_TICK_INTERVAL_MS);

      (async () => {
        try {
          const { result, retryCount } = await invokeWithAutoRetry({
            maxRetries: MAX_SUBAGENT_AUTO_RETRIES,
            signal: abortController.signal,
            onRetryScheduled: ({ retryIndex, maxRetries, delayMs, reason }) => {
              runState.retryCount = retryIndex;
              runState.lastRetryReason = reason;
              runState.lastActivityAt = Date.now();
              runState.lastLine = `Auto-retrying ${retryIndex}/${maxRetries} in ${Math.ceil(delayMs / 1000)}s: ${reason}`;
              runState.lastOutput = runState.lastLine;
              updateCommandRunsWidget(store);
              ctx.ui.notify(
                `subagent #${runId} retry ${retryIndex}/${maxRetries}: ${reason}`,
                "warning",
              );
            },
            invoke: () =>
              enqueueSubagentInvocation(() =>
                runSingleAgent(
                  ctx.cwd,
                  agents,
                  selectedAgent,
                  taskForAgent,
                  undefined,
                  abortController.signal,
                  (partial) => {
                    if (runState.removed) return;
                    const current = partial.details?.results?.[0];
                    if (!current) return;
                    updateRunFromResult(runState, current);
                    updateCommandRunsWidget(store);
                  },
                  makeDetails,
                  runState.sessionFile,
                ),
              ),
          });
          runState.retryCount = retryCount;

          if (runState.removed) return;

          updateRunFromResult(runState, result);
          const isError =
            result.exitCode !== 0 ||
            result.stopReason === "error" ||
            result.stopReason === "aborted";
          runState.status = isError ? "error" : "done";
          runState.elapsedMs = Date.now() - runState.startedAt;
          updateCommandRunsWidget(store);

          const rawOutput = isError
            ? result.errorMessage ||
              result.stderr ||
              getFinalOutput(result.messages) ||
              "(no output)"
            : getFinalOutput(result.messages) || "(no output)";
          const output =
            isError && rawOutput.length > RUN_OUTPUT_MESSAGE_MAX_CHARS
              ? `${rawOutput.slice(0, RUN_OUTPUT_MESSAGE_MAX_CHARS)}\n\n... [truncated]`
              : rawOutput;
          const usage = formatUsageStats(result.usage, result.model);

          runState.lastOutput = rawOutput;
          if (rawOutput) runState.lastLine = getLastNonEmptyLine(rawOutput);

          const completionMessage = {
            customType: "subagent-command" as const,
            content:
              `[subagent:${selectedAgent}#${runId}] ${isError ? "failed" : "completed"}` +
              `\nPrompt: ${truncateLines(taskForDisplay, 2)}` +
              (usage ? `\nUsage: ${usage}` : "") +
              (runState.retryCount
                ? `\nRetries: ${runState.retryCount}/${MAX_SUBAGENT_AUTO_RETRIES}`
                : "") +
              (runState.thoughtText ? `\nThought: ${runState.thoughtText}` : "") +
              `\n\n${output}`,
            display: true,
            details: {
              runId,
              agent: selectedAgent,
              task: taskForDisplay,
              continuedFromRunId,
              turnCount: runState.turnCount,
              contextMode: runState.contextMode,
              sessionFile: runState.sessionFile,
              startedAt: runState.startedAt,
              elapsedMs: runState.elapsedMs,
              lastActivityAt: runState.lastActivityAt,
              exitCode: result.exitCode,
              usage: result.usage,
              model: result.model,
              source: result.agentSource,
              thoughtText: runState.thoughtText,
              retryCount: runState.retryCount,
              status: runState.status,
            },
          };
          // Intentionally keep triggerTurn off for subagent status logs.
          // These are telemetry follow-ups, not user-facing turn triggers.
          if (isInOriginSession(ctx, originSessionFile)) {
            pi.sendMessage(completionMessage, { deliverAs: "followUp" });
            store.globalLiveRuns.delete(runId);
          } else {
            const globalEntry = store.globalLiveRuns.get(runId);
            if (globalEntry) {
              globalEntry.pendingCompletion = makePendingCompletion(completionMessage, false);
            }
            // Re-insert into commandRuns so the widget shows completion.
            store.commandRuns.set(runId, runState);
          }

          ctx.ui.notify(
            isError
              ? `subagent #${runId} (${selectedAgent}) failed`
              : `subagent #${runId} (${selectedAgent}) completed`,
            isError ? "error" : "info",
          );
        } catch (error: unknown) {
          if (runState.removed) return;
          runState.status = "error";
          runState.elapsedMs = Date.now() - runState.startedAt;
          runState.lastLine = error instanceof Error ? error.message : "Subagent execution failed";
          runState.lastOutput = runState.lastLine;

          const cmdErrorMessage = {
            customType: "subagent-command" as const,
            content:
              `[subagent:${selectedAgent}#${runId}] failed` +
              `\nPrompt: ${truncateLines(taskForDisplay, 2)}` +
              `\n\n${runState.lastLine}`,
            display: true,
            details: {
              runId,
              agent: selectedAgent,
              task: taskForDisplay,
              continuedFromRunId,
              turnCount: runState.turnCount,
              contextMode: runState.contextMode,
              sessionFile: runState.sessionFile,
              startedAt: runState.startedAt,
              elapsedMs: runState.elapsedMs,
              lastActivityAt: runState.lastActivityAt,
              error: runState.lastLine,
              thoughtText: runState.thoughtText,
              status: runState.status,
            },
          };

          // Keep triggerTurn disabled for error telemetry as well.
          if (isInOriginSession(ctx, originSessionFile)) {
            pi.sendMessage(cmdErrorMessage, { deliverAs: "followUp" });
            store.globalLiveRuns.delete(runId);
          } else {
            const cmdErrGlobalEntry = store.globalLiveRuns.get(runId);
            if (cmdErrGlobalEntry) {
              cmdErrGlobalEntry.pendingCompletion = makePendingCompletion(cmdErrorMessage, false);
            }
            store.commandRuns.set(runId, runState);
          }

          ctx.ui.notify(`subagent #${runId} failed: ${runState.lastLine}`, "error");
        } finally {
          clearInterval(tick);
          finalizeAndCleanup(store, runState, { ctx, pi });
        }
      })().catch(() => {
        /* fire-and-forget: errors handled internally */
      });
    },
  };
}
