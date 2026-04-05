/**
 * Subagent tool — execute handler factory.
 * Thin dispatcher that parses the CLI command, sets up shared context,
 * and delegates to the appropriate action handler.
 */

import { discoverAgents } from "../agent/discovery.js";
import { parseSubagentToolCommand, SUBAGENT_CLI_HELP_TEXT } from "../cli/parser.js";
import { MAX_CONCURRENT_ASYNC_SUBAGENT_RUNS } from "../core/constants.js";
import type { SubagentDeps } from "../core/deps.js";
import { updateRunFromResult } from "../core/store.js";
import type {
  BatchOrChainItem,
  CommandRunState,
  OnUpdateCallback,
  SingleResult,
  SubagentDetails,
  SubagentLaunchSummary,
} from "../core/types.js";
import type { RunLaunchConfig } from "../execution/orchestrator.js";
import { getCurrentSessionFile, registerRunLaunch } from "../execution/orchestrator.js";
import { enqueueSubagentInvocation } from "../execution/run.js";
import { runSingleAgent } from "../execution/runner.js";
import { buildMainContextText } from "../session/context.js";
import { updateCommandRunsWidget } from "../ui/widget.js";
import { handleBatchAction } from "./actions/batch.js";
import { handleChainAction } from "./actions/chain.js";
import { handleLaunchAction } from "./actions/launch.js";
import { handleAbortAction, handleRemoveAction } from "./actions/mutate.js";
import { handleDetailAction, handleListAction, handleStatusAction } from "./actions/query.js";
import {
  createEmptyDetails,
  finalizeRunState,
  getRunCounts,
  makeIdleRunWarningWrapper,
} from "./helpers.js";
import type {
  FinalizedRun,
  LaunchMode,
  SubagentExecuteResult,
  SubagentToolExecuteContext,
} from "./types.js";

export function createSubagentToolExecute(deps: SubagentDeps) {
  const { pi, store } = deps;

  return async (
    _toolCallId: string,
    params: Record<string, unknown>,
    _signal: AbortSignal | undefined,
    _onUpdate: OnUpdateCallback | undefined,
    ctx: SubagentToolExecuteContext,
  ): Promise<SubagentExecuteResult> => {
    const knownRunIds = Array.from(store.commandRuns.values())
      .filter((run) => !run.removed)
      .map((run) => run.id);
    const parsedCommand = parseSubagentToolCommand(params.command, { knownRunIds });

    if (parsedCommand.type === "error") {
      return {
        content: [{ type: "text", text: `${parsedCommand.message}\n\n${SUBAGENT_CLI_HELP_TEXT}` }],
        details: createEmptyDetails("single", false, null),
        isError: true,
      };
    }

    if (parsedCommand.type === "help") {
      return {
        content: [{ type: "text", text: SUBAGENT_CLI_HELP_TEXT }],
        details: createEmptyDetails("single", false, null),
      };
    }

    const discovery = discoverAgents(ctx.cwd);
    const agents = discovery.agents;

    if (parsedCommand.type === "agents") {
      if (agents.length === 0) {
        return {
          content: [{ type: "text", text: "No subagents found." }],
          details: createEmptyDetails("single", false, discovery.projectAgentsDir),
        };
      }

      const lines = agents.map((agent) => {
        const model = agent.model ?? "(inherit current model)";
        const thinking = agent.thinking ?? "(inherit current thinking)";
        const tools = agent.tools && agent.tools.length > 0 ? agent.tools.join(",") : "default";
        // discoverAgents guarantees description is non-empty.
        return `${agent.name} [${agent.source}] · model: ${model} · thinking: ${thinking} · tools: ${tools} · ${agent.description}`;
      });

      return {
        content: [{ type: "text", text: `Available subagents\n\n${lines.join("\n")}` }],
        details: createEmptyDetails("single", false, discovery.projectAgentsDir),
      };
    }

    const resolvedParams = parsedCommand.params;
    const asyncAction = resolvedParams.asyncAction ?? "run";
    const contextMode = resolvedParams.contextMode ?? "isolated";
    const inheritMainContext = contextMode === "main";
    const rawMainContext = inheritMainContext
      ? buildMainContextText(ctx)
      : { text: "", totalMessageCount: 0 };
    const mainContextText = rawMainContext.text;
    const totalMessageCount = rawMainContext.totalMessageCount;
    const mainSessionFile = inheritMainContext
      ? getCurrentSessionFile(ctx) || undefined
      : undefined;
    const originSessionFile = getCurrentSessionFile(ctx);

    const runCounts = getRunCounts(store);
    const withIdleRunWarning = makeIdleRunWarningWrapper(runCounts.idle, ctx);

    const hasBatch = asyncAction === "batch";
    const hasChain = asyncAction === "chain";
    const hasSingle = asyncAction === "run" || asyncAction === "continue";
    const mode: LaunchMode = hasBatch ? "batch" : hasChain ? "chain" : "single";
    const makeDetails = (
      modeOverride: LaunchMode = mode,
      results: SingleResult[] = [],
      launches: SubagentLaunchSummary[] = [],
    ): SubagentDetails => ({
      mode: modeOverride,
      inheritMainContext,
      projectAgentsDir: discovery.projectAgentsDir,
      results,
      launches,
    });

    if ((hasSingle || hasBatch || hasChain) && inheritMainContext && !mainSessionFile) {
      return {
        content: [
          {
            type: "text",
            text: "contextMode=main requires an active main session. Current session is unavailable (e.g. --no-session).",
          },
        ],
        details: makeDetails(),
        isError: true,
      };
    }

    // Early validation: check that all requested agent names exist before launching
    if (hasSingle || hasBatch || hasChain) {
      const requestedNames: string[] = [];
      if (hasSingle) {
        // Parser always supplies `agent` for `run` and makes it optional for
        // `continue` (where it can be omitted to reuse the prior run's agent).
        // For early-validation we only need to check that an explicit `agent`
        // override exists in the known list; when omitted we default to
        // "worker" which is always expected to be available.
        const name = (resolvedParams.agent as string | undefined) ?? "worker";
        requestedNames.push(name);
      }
      if (hasBatch && Array.isArray(resolvedParams.runs)) {
        for (const item of resolvedParams.runs as BatchOrChainItem[])
          requestedNames.push(item.agent);
      }
      if (hasChain && Array.isArray(resolvedParams.steps)) {
        for (const step of resolvedParams.steps as BatchOrChainItem[])
          requestedNames.push(step.agent);
      }
      const unknownNames = [...new Set(requestedNames)].filter(
        (name) => !agents.some((a) => a.name === name),
      );
      if (unknownNames.length > 0) {
        const available = agents.map((a) => `"${a.name}"`).join(", ") || "none";
        return {
          content: [
            {
              type: "text",
              text: `❌ Unknown agent${unknownNames.length > 1 ? "s" : ""}: ${unknownNames.map((n) => `"${n}"`).join(", ")}.\n\nAvailable agents: ${available}`,
            },
          ],
          details: makeDetails(),
          isError: true,
        };
      }
    }

    // ── Query actions ──────────────────────────────────────────────────
    if (asyncAction === "list") {
      return handleListAction(store, ctx, makeDetails, withIdleRunWarning);
    }

    // ── RunId / RunIds resolution for non-launch actions ───────────────
    // Trust boundary: `resolvedParams` comes from parseSubagentToolCommand,
    // which guarantees:
    //   - `status`/`detail` always set `runId: number` (never `runIds`)
    //   - `abort`/`remove` always set exactly one of `runId` or `runIds: number[]`
    // So we don't re-validate here.
    const rawRunIds = Array.isArray(resolvedParams.runIds)
      ? (resolvedParams.runIds as number[])
      : undefined;
    const runIdsFromArray = rawRunIds ?? [];
    const hasRunIds = runIdsFromArray.length > 0;

    if (!hasSingle && !hasBatch && !hasChain) {
      const targetRunIds = hasRunIds
        ? Array.from(new Set(runIdsFromArray))
        : [resolvedParams.runId as number];
      // Parser guarantees targetRunIds has at least one element.
      const firstRunId = targetRunIds[0] as number;

      if (asyncAction === "status") {
        return handleStatusAction(firstRunId, store, makeDetails);
      }

      if (asyncAction === "detail") {
        return handleDetailAction(firstRunId, store, makeDetails);
      }

      if (asyncAction === "abort") {
        return handleAbortAction(targetRunIds, store, ctx, makeDetails);
      }

      if (asyncAction === "remove") {
        return handleRemoveAction(targetRunIds, store, ctx, pi, makeDetails);
      }
    }

    // ── Concurrent run limit check ─────────────────────────────────────
    // Trust boundary: parser guarantees `runs: BatchOrChainItem[]` for batch.
    const requestedLaunchCount = hasBatch ? (resolvedParams.runs as unknown[]).length : 1;
    if (runCounts.running + requestedLaunchCount > MAX_CONCURRENT_ASYNC_SUBAGENT_RUNS) {
      return {
        content: [
          {
            type: "text",
            text: withIdleRunWarning(
              `Too many running subagent runs (${runCounts.running}). Max is ${MAX_CONCURRENT_ASYNC_SUBAGENT_RUNS}. Wait for completion, abort unnecessary runs, or remove stale runs before starting more runs.`,
            ),
          },
        ],
        details: makeDetails(),
        isError: true,
      };
    }

    // ── Shared launch helpers ──────────────────────────────────────────
    function launchRun(config: Omit<RunLaunchConfig, "source">): CommandRunState {
      return registerRunLaunch(store, ctx, { ...config, source: "tool" });
    }

    function cleanupRunAfterFinalDelivery(runId: number) {
      store.globalLiveRuns.delete(runId);
      store.recentLaunchTimestamps.delete(runId);
    }

    function launchRunInBackground(
      runState: CommandRunState,
      taskForAgent: string,
    ): Promise<FinalizedRun> {
      return enqueueSubagentInvocation(() =>
        runSingleAgent(
          ctx.cwd,
          agents,
          runState.agent,
          taskForAgent,
          runState.pipelineStepIndex,
          runState.abortController?.signal,
          (partial) => {
            if (runState.removed) return;
            // runSingleAgent's emitUpdate always includes a single-entry
            // results array on details.
            const current = (partial.details as SubagentDetails).results[0] as SingleResult;
            updateRunFromResult(runState, current);
            updateCommandRunsWidget(store);
          },
          (results) => makeDetails(mode, results),
          runState.sessionFile,
        ),
      ).then((result) => finalizeRunState(runState, result));
    }

    // ── Launch actions ─────────────────────────────────────────────────
    const sharedLaunchCtx = {
      store,
      ctx,
      pi,
      agents,
      mainContextText,
      totalMessageCount,
      mainSessionFile,
      originSessionFile,
      inheritMainContext,
      mode,
      makeDetails,
      withIdleRunWarning,
      launchRun,
      launchRunInBackground,
      cleanupRunAfterFinalDelivery,
    };

    if (hasSingle) {
      return handleLaunchAction(resolvedParams, sharedLaunchCtx);
    }

    if (hasBatch) {
      return handleBatchAction(resolvedParams, sharedLaunchCtx);
    }

    // At this point `hasChain` must be true: the parser only emits
    // list/status/detail/abort/remove/run/continue/batch/chain, and all other
    // values are returned to the caller before this block.
    return handleChainAction(resolvedParams, sharedLaunchCtx);
  };
}
