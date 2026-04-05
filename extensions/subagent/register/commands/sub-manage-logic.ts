/**
 * Pure logic for subagent management commands (/sub:open, /sub:rm, /sub:clear,
 * /sub:abort, /sub:history).
 *
 * These helpers expose the parsing and selection decisions so each command
 * wrapper in `sub-manage.ts` can stay a thin pi-SDK integration surface.
 */

import { COMMAND_COMPLETION_LIMIT, COMMAND_TASK_PREVIEW_CHARS } from "../../core/constants.js";
import type { CommandRunState } from "../../core/types.js";
import { truncateText } from "../../ui/format.js";
import type { CompletionItem } from "./sub-run-logic.js";

// ━━━ Run-id argument parsing ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type SingleRunTargetRequest =
  | { kind: "empty" }
  | { kind: "by-id"; id: number }
  | { kind: "invalid" };

/**
 * Parse the raw argument of commands like `/sub:open [runId]` and `/sub:rm
 * [runId]` — those that accept either nothing (→ latest run) or a single id.
 */
export function parseRunIdArg(rawArg: string | undefined | null): SingleRunTargetRequest {
  const raw = (rawArg ?? "").trim();
  if (!raw) return { kind: "empty" };
  if (/^\d+$/.test(raw)) return { kind: "by-id", id: Number(raw) };
  return { kind: "invalid" };
}

// ━━━ /sub:open completions ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Build the argument completions list for `/sub:open` — the runIds visible in
 * the widget, sorted latest-first.
 */
export function buildSubOpenCompletions(
  runs: readonly CommandRunState[],
  argumentPrefix: string,
): CompletionItem[] | null {
  const trimmedStart = argumentPrefix.trimStart();
  if (trimmedStart.includes(" ")) return null;
  const items = [...runs]
    .sort((a, b) => b.id - a.id)
    .filter((run) => !trimmedStart || run.id.toString().startsWith(trimmedStart))
    .slice(0, COMMAND_COMPLETION_LIMIT)
    .map<CompletionItem>((run) => ({
      value: `${run.id}`,
      label: `${run.id}`,
      description: `${run.status} ${run.agent}: ${truncateText(run.task, COMMAND_TASK_PREVIEW_CHARS)}`,
    }));
  return items.length > 0 ? items : null;
}

// ━━━ /sub:history fallback listing ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Format the plain-text history fallback (used when ctx has no UI).
 * Returns one line per run; the caller joins them with "\n".
 */
export function formatHistoryFallbackLines(runs: readonly CommandRunState[]): string[] {
  return runs.map((r) => {
    const removed = r.removed ? " [removed]" : "";
    const task = r.task
      .replace(/\s*\n+\s*/g, " ")
      .trim()
      .slice(0, COMMAND_TASK_PREVIEW_CHARS);
    return `#${r.id} [${r.status}]${removed} ${r.agent}: ${task}`;
  });
}

/**
 * Sort runs latest-first for the history overlay (startedAt desc).
 */
export function sortRunsForHistory(runs: readonly CommandRunState[]): CommandRunState[] {
  return [...runs].sort((a, b) => b.startedAt - a.startedAt);
}

// ━━━ /sub:clear target selection ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type SubClearMode = "all" | "finished-only";

export function parseSubClearMode(rawArg: string | undefined | null): SubClearMode {
  const mode = (rawArg ?? "").trim().toLowerCase();
  return mode === "all" ? "all" : "finished-only";
}

/**
 * Given the full run list, select which runs the `/sub:clear` command should
 * attempt to remove. For `all`, that's everything; for `finished-only`, that's
 * only non-running runs.
 */
export function selectSubClearTargets(
  runs: readonly CommandRunState[],
  mode: SubClearMode,
): CommandRunState[] {
  if (mode === "all") return [...runs];
  return runs.filter((run) => run.status !== "running");
}

/** Format the user-facing summary for `/sub:clear all`. */
export function formatSubClearAllSummary(removed: number, aborted: number): string {
  return aborted > 0
    ? `Cleared ${removed} subagent job(s), aborting ${aborted} running job(s).`
    : `Cleared ${removed} subagent job(s).`;
}

/** Format the user-facing summary for `/sub:clear` (finished-only). */
export function formatSubClearFinishedSummary(removed: number): string {
  return `Cleared ${removed} finished subagent job(s).`;
}

// ━━━ /sub:abort target selection ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type SubAbortTarget =
  | { kind: "none-running" }
  | { kind: "latest"; run: CommandRunState }
  | { kind: "all"; runs: CommandRunState[] }
  | { kind: "by-id"; id: number }
  | { kind: "invalid" };

export function selectSubAbortTarget(
  runs: readonly CommandRunState[],
  rawArg: string | undefined | null,
): SubAbortTarget {
  const running = [...runs].filter((run) => run.status === "running").sort((a, b) => b.id - a.id);
  const latest = running[0];
  if (!latest) return { kind: "none-running" };

  const raw = (rawArg ?? "").trim().toLowerCase();
  if (!raw) return { kind: "latest", run: latest };
  if (raw === "all") return { kind: "all", runs: running };
  if (/^\d+$/.test(raw)) return { kind: "by-id", id: Number(raw) };
  return { kind: "invalid" };
}

/**
 * Classify a "by-id" abort target against the current store snapshot.
 * The caller uses this to pick the right user notification.
 */
export type SubAbortByIdValidation =
  | { kind: "unknown" }
  | { kind: "not-running" }
  | { kind: "ready"; run: CommandRunState };

export function validateSubAbortById(run: CommandRunState | undefined): SubAbortByIdValidation {
  if (!run) return { kind: "unknown" };
  if (run.status !== "running") return { kind: "not-running" };
  return { kind: "ready", run };
}

// ━━━ Formatting helpers ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Pretty-print the "Available run IDs" helper used by /sub:open + /sub:rm. */
export function formatAvailableRunIds(runs: readonly CommandRunState[]): string {
  const ids = runs.map((r) => r.id).sort((a, b) => a - b);
  return ids.length > 0
    ? `Available run IDs: ${ids.join(", ")}`
    : "No recent subagent runs available.";
}

export const SUB_OPEN_USAGE = "Usage: /sub:open [runId]";
export const SUB_RM_USAGE = "Usage: /sub:rm [runId]";
export const SUB_ABORT_USAGE = "Usage: /sub:abort [runId|all]";

export const NO_SUBAGENT_RUNS_YET = "No subagent runs yet.";
export const NO_SUBAGENT_RUNS_TO_REMOVE = "No subagent runs to remove.";
export const NO_SUBAGENT_HISTORY_YET = "No subagent run history yet.";
export const NO_RUNNING_SUBAGENT_JOBS = "No running subagent jobs.";
export const NO_ABORTABLE_SUBAGENT_JOBS = "No abortable subagent jobs.";
