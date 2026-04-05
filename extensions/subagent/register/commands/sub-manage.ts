/**
 * Thin pi-SDK wrapper for subagent management commands (/sub:open, /sub:history,
 * /sub:rm, /sub:clear, /sub:abort, /sub:back).
 *
 * All argument parsing, bulk-target selection, and completion rendering live
 * in `./sub-manage-logic.ts` and are covered by
 * `__tests__/sub-manage-logic.test.ts`. This file composes those decisions with
 * pi ExtensionContext (ui.notify, ui.custom overlay rendering, fs existence
 * checks on session files) and pi SDK commands (`pi.registerCommand`,
 * `removeRun`, `updateCommandRunsWidget`).
 *
 * Coverage: this wrapper is EXCLUDED from `npm run test:subagent` coverage
 * because the remaining branching is ExtensionContext wiring (overlay
 * rendering, fs session-file probes, widget refresh plumbing, controller
 * abort side effects) that is not exercisable as pure logic. The extracted
 * decisions in `sub-manage-logic.ts` are fully covered instead.
 */

import * as fs from "node:fs";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import {
  DEFAULT_TURN_COUNT,
  MS_PER_SECOND,
  SUBVIEW_OVERLAY_MAX_HEIGHT,
  SUBVIEW_OVERLAY_WIDTH,
} from "../../core/constants.js";
import type { SubagentDeps } from "../../core/deps.js";
import type { CommandRunState } from "../../core/types.js";
import { getLatestRun, removeRun } from "../../execution/run.js";
import { captureSwitchSession, subBackHandler, subTransHandler } from "../../session/navigation.js";
import { formatUsageStats } from "../../ui/format.js";
import { SubagentHistoryOverlay } from "../../ui/history-overlay.js";
import { readSessionReplayItems, SubagentSessionReplayOverlay } from "../../ui/replay.js";
import { toWidgetCtx, updateCommandRunsWidget } from "../../ui/widget.js";
import {
  buildSubOpenCompletions,
  formatAvailableRunIds,
  formatHistoryFallbackLines,
  formatSubClearAllSummary,
  formatSubClearFinishedSummary,
  NO_ABORTABLE_SUBAGENT_JOBS,
  NO_RUNNING_SUBAGENT_JOBS,
  NO_SUBAGENT_HISTORY_YET,
  NO_SUBAGENT_RUNS_TO_REMOVE,
  NO_SUBAGENT_RUNS_YET,
  parseRunIdArg,
  parseSubClearMode,
  SUB_ABORT_USAGE,
  SUB_OPEN_USAGE,
  SUB_RM_USAGE,
  selectSubAbortTarget,
  selectSubClearTargets,
  sortRunsForHistory,
  validateSubAbortById,
} from "./sub-manage-logic.js";

export function registerManagementCommands(deps: SubagentDeps): {
  handleSubClear: (args: string, ctx: ExtensionContext) => Promise<void>;
  handleSubAbort: (args: string, ctx: ExtensionContext) => Promise<void>;
} {
  const { pi, store } = deps;

  // ── sub:open ─────────────────────────────────────────────────────────
  pi.registerCommand("sub:open", {
    description: "Open a subagent session replay overlay: /sub:open [runId]",
    getArgumentCompletions: (argumentPrefix) =>
      buildSubOpenCompletions(Array.from(store.commandRuns.values()), argumentPrefix),
    handler: async (args, ctx) => {
      captureSwitchSession(store, ctx);
      const request = parseRunIdArg(args);
      let id: number;
      let run: CommandRunState | undefined;

      if (request.kind === "empty") {
        run = getLatestRun(store);
        if (!run) {
          ctx.ui.notify(NO_SUBAGENT_RUNS_YET, "info");
          return;
        }
        id = run.id;
      } else if (request.kind === "by-id") {
        id = request.id;
        run = store.commandRuns.get(id);
      } else {
        ctx.ui.notify(SUB_OPEN_USAGE, "info");
        return;
      }
      if (!run) {
        const availableText = formatAvailableRunIds(Array.from(store.commandRuns.values()));
        ctx.ui.notify(`Unknown subagent run #${id}. ${availableText}`, "error");
        return;
      }

      const elapsedSec = Math.max(0, Math.round(run.elapsedMs / MS_PER_SECOND));
      const usageLine = run.usage ? `\nUsage: ${formatUsageStats(run.usage, run.model)}` : "";
      const output = (run.lastOutput ?? "").trim();
      const fallback =
        run.status === "running"
          ? "(still running; no final output yet)"
          : run.lastLine || "(no output captured)";
      const contextLabel = run.contextMode === "main" ? "main" : "isolated";
      const content =
        `Subagent #${run.id} [${run.status}] ${run.agent} ctx:${contextLabel} turn:${run.turnCount ?? DEFAULT_TURN_COUNT} ${elapsedSec}s tools:${run.toolCalls}` +
        `\n${run.task}` +
        usageLine +
        `\n\n${output || fallback}`;

      if (!ctx.hasUI) {
        return;
      }

      if (!run.sessionFile || !fs.existsSync(run.sessionFile)) {
        ctx.ui.notify(content, "info");
        return;
      }

      const replayItems = readSessionReplayItems(run.sessionFile);
      if (replayItems.length === 0) {
        ctx.ui.notify(content, "info");
        return;
      }

      await ctx.ui.custom(
        (tui, theme, _kb, done) => {
          const overlay = new SubagentSessionReplayOverlay(run, replayItems, () => done(undefined));
          return {
            render: (w) => overlay.render(w, 0 /* height computed internally */, theme),
            handleInput: (data) => overlay.handleInput(data, tui),
            invalidate: () => {
              /* noop */
            },
          };
        },
        {
          overlay: true,
          overlayOptions: {
            width: SUBVIEW_OVERLAY_WIDTH,
            maxHeight: SUBVIEW_OVERLAY_MAX_HEIGHT,
            anchor: "center",
          },
        },
      );
    },
  });

  // ── sub:history ──────────────────────────────────────────────────────
  pi.registerCommand("sub:history", {
    description: "Show all subagent run history (including removed) in an overlay: /sub:history",
    handler: async (_args, ctx) => {
      captureSwitchSession(store, ctx);

      const allRuns = sortRunsForHistory(Array.from(store.commandRuns.values()));

      if (allRuns.length === 0) {
        ctx.ui.notify(NO_SUBAGENT_HISTORY_YET, "info");
        return;
      }

      if (!ctx.hasUI) {
        // Fallback: plain text list
        const lines = formatHistoryFallbackLines(allRuns);
        ctx.ui.notify(lines.join("\n"), "info");
        return;
      }

      ctx.ui.setWidget("pixel-subagents", undefined);

      await ctx.ui.custom(
        (tui, theme, _kb, done) => {
          const overlay = new SubagentHistoryOverlay(
            allRuns,
            async (run) => {
              done(undefined);
              // Check if the selected run has a session file before trying to trans
              if (!run.sessionFile) {
                ctx.ui.notify(
                  `Run #${run.id} (${run.agent}) does not have a session file yet and cannot be opened.`,
                  "warning",
                );
                return;
              }
              await subTransHandler(run.id.toString(), ctx, store, pi);
            },
            () => done(undefined),
          );
          return {
            render: (w) => overlay.render(w, 0, theme),
            handleInput: (data) => overlay.handleInput(data, tui),
            invalidate: () => {
              /* noop */
            },
          };
        },
        {
          overlay: true,
          overlayOptions: {
            width: SUBVIEW_OVERLAY_WIDTH,
            maxHeight: SUBVIEW_OVERLAY_MAX_HEIGHT,
            anchor: "center",
          },
        },
      );
    },
  });

  // ── sub:rm ───────────────────────────────────────────────────────────
  pi.registerCommand("sub:rm", {
    description: "Remove one /sub job entry (aborts it if running): /sub:rm [runId]",
    handler: async (args, ctx) => {
      captureSwitchSession(store, ctx);
      const request = parseRunIdArg(args);
      let id: number;
      let run: CommandRunState | undefined;

      if (request.kind === "empty") {
        run = getLatestRun(store);
        if (!run) {
          ctx.ui.notify(NO_SUBAGENT_RUNS_TO_REMOVE, "info");
          return;
        }
        id = run.id;
      } else if (request.kind === "by-id") {
        id = request.id;
        run = store.commandRuns.get(id);
      } else {
        ctx.ui.notify(SUB_RM_USAGE, "info");
        return;
      }
      if (!run) {
        ctx.ui.notify(`Unknown subagent run #${id}.`, "error");
        return;
      }

      const { aborted } = removeRun(store, id, {
        ctx: toWidgetCtx(ctx),
        pi,
        reason: "Aborting by /sub:rm...",
        removalReason: "sub-rm",
      });
      ctx.ui.notify(
        aborted ? `Removed subagent #${id} (aborting in background).` : `Removed subagent #${id}.`,
        aborted ? "warning" : "info",
      );
    },
  });

  // ── sub:clear ────────────────────────────────────────────────────────
  const handleSubClear = async (args: string, ctx: ExtensionContext) => {
    captureSwitchSession(store, ctx);
    const mode = parseSubClearMode(args);
    const targets = selectSubClearTargets(Array.from(store.commandRuns.values()), mode);

    if (mode === "all") {
      let removed = 0;
      let aborted = 0;
      for (const target of targets) {
        const result = removeRun(store, target.id, {
          ctx: toWidgetCtx(ctx),
          pi,
          updateWidget: false,
          reason: "Aborting by /sub:clear all...",
          removalReason: "sub-clear",
        });
        if (!result.removed) continue;
        removed++;
        if (result.aborted) aborted++;
      }
      updateCommandRunsWidget(store, toWidgetCtx(ctx));
      ctx.ui.notify(formatSubClearAllSummary(removed, aborted), aborted > 0 ? "warning" : "info");
      return;
    }

    let removed = 0;
    for (const target of targets) {
      const result = removeRun(store, target.id, {
        ctx: toWidgetCtx(ctx),
        pi,
        updateWidget: false,
        abortIfRunning: false,
        removalReason: "sub-clear",
      });
      if (result.removed) removed++;
    }
    updateCommandRunsWidget(store, toWidgetCtx(ctx));
    ctx.ui.notify(formatSubClearFinishedSummary(removed), "info");
  };

  pi.registerCommand("sub:clear", {
    description: "Clear /sub job widget entries. /sub:clear (finished only) or /sub:clear all",
    handler: async (args, ctx) => {
      await handleSubClear(args, ctx);
    },
  });

  // ── sub:abort ────────────────────────────────────────────────────────
  const handleSubAbort = async (args: string, ctx: ExtensionContext) => {
    const target = selectSubAbortTarget(Array.from(store.commandRuns.values()), args);

    if (target.kind === "none-running") {
      ctx.ui.notify(NO_RUNNING_SUBAGENT_JOBS, "info");
      return;
    }

    const abortRun = (run: CommandRunState): boolean => {
      // Try the run's own controller first, then fall back to globalLiveRuns
      // (the run's controller may have been cleared after a session switch).
      const controller = run.abortController ?? store.globalLiveRuns.get(run.id)?.abortController;
      if (!controller) return false;
      run.lastLine = "Aborting by user...";
      run.lastOutput = run.lastLine;
      controller.abort();
      return true;
    };

    if (target.kind === "latest") {
      if (!abortRun(target.run)) {
        ctx.ui.notify(`Subagent #${target.run.id} is not abortable right now.`, "warning");
        return;
      }
      updateCommandRunsWidget(store, toWidgetCtx(ctx));
      ctx.ui.notify(`Aborting subagent #${target.run.id} (${target.run.agent})...`, "warning");
      return;
    }

    if (target.kind === "all") {
      let count = 0;
      for (const run of target.runs) {
        if (abortRun(run)) count++;
      }
      updateCommandRunsWidget(store, toWidgetCtx(ctx));
      ctx.ui.notify(
        count > 0 ? `Aborting ${count} running subagent job(s)...` : NO_ABORTABLE_SUBAGENT_JOBS,
        count > 0 ? "warning" : "info",
      );
      return;
    }

    if (target.kind === "by-id") {
      const validation = validateSubAbortById(store.commandRuns.get(target.id));
      if (validation.kind === "unknown") {
        ctx.ui.notify(`Unknown subagent run #${target.id}.`, "error");
        return;
      }
      if (validation.kind === "not-running") {
        ctx.ui.notify(`Subagent #${target.id} is not running.`, "info");
        return;
      }
      if (!abortRun(validation.run)) {
        ctx.ui.notify(`Subagent #${target.id} is not abortable right now.`, "warning");
        return;
      }
      updateCommandRunsWidget(store, toWidgetCtx(ctx));
      ctx.ui.notify(`Aborting subagent #${target.id} (${validation.run.agent})...`, "warning");
      return;
    }

    // target.kind === "invalid"
    ctx.ui.notify(SUB_ABORT_USAGE, "info");
  };

  pi.registerCommand("sub:abort", {
    description: "Abort running subagent job(s). /sub:abort [runId|all]",
    handler: async (args, ctx) => {
      captureSwitchSession(store, ctx);
      await handleSubAbort(args, ctx);
    },
  });

  // ── sub:back ─────────────────────────────────────────────────────────
  pi.registerCommand("sub:back", {
    description: "Return to parent session (pop from session stack): /sub:back",
    handler: async (_args, ctx) => {
      captureSwitchSession(store, ctx);
      await subBackHandler(ctx, store);
    },
  });

  return { handleSubClear, handleSubAbort };
}
