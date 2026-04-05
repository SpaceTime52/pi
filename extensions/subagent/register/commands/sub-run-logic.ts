/**
 * Pure logic for `/sub:isolate` / `/sub:main` slash commands.
 *
 * These helpers are extracted from `sub-run.ts` so they can be tested in
 * isolation without needing a full pi runtime, ExtensionContext, or store.
 *
 * Design:
 *   - No ExtensionContext access, no pi SDK calls, no mutation of the store
 *     (mutations happen in the thin wrapper that calls these helpers).
 *   - All dependencies (agents, run lookup) are passed as parameters.
 */

import { matchSubCommandAgent } from "../../agent/discovery.js";
import {
  COMMAND_COMPLETION_LIMIT,
  COMMAND_TASK_PREVIEW_CHARS,
  CONTINUATION_OUTPUT_CONTEXT_MAX_CHARS,
} from "../../core/constants.js";
import type { AgentConfig, CommandRunState } from "../../core/types.js";
import { truncateText } from "../../ui/format.js";

// ━━━ Argument parsing ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface ParsedSubRunArgs {
  /** The trimmed whole input. "" if empty. */
  input: string;
  /** First whitespace token (empty string when input is empty). */
  firstToken: string;
  /** Index of the first space in input, or -1 when no space present. */
  firstSpace: number;
  /** Remainder after first token, trimmed. undefined if no space present. */
  rest: string | undefined;
  /** True if the first token is a positive integer (candidate run id). */
  isNumericFirstToken: boolean;
}

export function parseSubRunArgs(rawInput: string | undefined | null): ParsedSubRunArgs {
  const input = (rawInput ?? "").trim();
  if (!input) {
    return {
      input: "",
      firstToken: "",
      firstSpace: -1,
      rest: undefined,
      isNumericFirstToken: false,
    };
  }
  const firstSpace = input.indexOf(" ");
  const firstToken = firstSpace === -1 ? input : input.slice(0, firstSpace);
  const rest = firstSpace === -1 ? undefined : input.slice(firstSpace + 1).trim();
  const isNumericFirstToken = /^\d+$/.test(firstToken);
  return { input, firstToken, firstSpace, rest, isNumericFirstToken };
}

/** True if the user explicitly used the forbidden `--main` prefix. */
export function isLegacyMainPrefix(rawInput: string | undefined | null): boolean {
  const input = (rawInput ?? "").trim();
  return input === "--main" || input.startsWith("--main ");
}

// ━━━ Agent resolution ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Resolve the agent to reuse when continuing an existing run. */
export function resolveContinuationAgent(agents: AgentConfig[], previousAgentName: string): string {
  const directAgent = agents.find(
    (agent) => agent.name.toLowerCase() === previousAgentName.toLowerCase(),
  );
  const fuzzyAgent = matchSubCommandAgent(agents, previousAgentName).matchedAgent;
  return directAgent?.name ?? fuzzyAgent?.name ?? previousAgentName;
}

/** True when `name` is present in `agents`. */
export function agentExists(agents: AgentConfig[], name: string): boolean {
  return agents.some((agent) => agent.name === name);
}

// ━━━ Continuation task construction ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Build the `taskForAgent` for a fallback-continuation (the previous run had
 * no dedicated session file — we have to stitch context into the prompt).
 */
export function buildFallbackContinuationTask(options: {
  targetRunId: number;
  selectedAgent: string;
  previousTask: string;
  previousOutput: string;
  nextInstruction: string;
}): string {
  const { targetRunId, selectedAgent, previousTask, previousOutput, nextInstruction } = options;
  const clipped =
    previousOutput.length > CONTINUATION_OUTPUT_CONTEXT_MAX_CHARS
      ? `${previousOutput.slice(0, CONTINUATION_OUTPUT_CONTEXT_MAX_CHARS)}\n... [truncated]`
      : previousOutput;
  return [
    `Continue subagent run #${targetRunId} using the same agent (${selectedAgent}).`,
    `Previous task:\n${previousTask}`,
    clipped ? `Previous output:\n${clipped}` : "Previous output: (not available)",
    `New instruction:\n${nextInstruction}`,
  ].join("\n\n");
}

/** Compute the display-only prefix for a continuation task. */
export function formatContinuationDisplay(targetRunId: number, nextInstruction: string): string {
  return `[continue #${targetRunId}] ${nextInstruction}`;
}

// ━━━ Dispatch decision ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type SubRunDecision =
  | { kind: "empty-input" }
  | { kind: "legacy-main-prefix" }
  | { kind: "no-agents-found" }
  | { kind: "usage-missing-task" }
  /** The first token was a runId that does not match any existing run. */
  | { kind: "continuation-target-running"; targetRunId: number }
  | { kind: "continuation-target-unknown-agent"; targetRunId: number; previousAgentName: string }
  | {
      kind: "continuation";
      targetRunId: number;
      selectedAgent: string;
      taskForDisplay: string;
      /** True continuation reuses the per-run session file; fallback stitches output into task. */
      reusesSessionFile: boolean;
      /** When `reusesSessionFile`, this is the bare `nextInstruction`.
       *  When fallback, this is the full stitched prompt. */
      taskForAgent: string;
    }
  | {
      kind: "ambiguous-agent";
      firstToken: string;
      ambiguousAgents: AgentConfig[];
      /** If firstSpace === -1 (no task provided yet), only usage+error is surfaced. */
      taskProvided: boolean;
    }
  | {
      kind: "resolved";
      selectedAgent: string;
      taskForDisplay: string;
      taskForAgent: string;
    };

export interface SubRunDecisionDeps {
  agents: AgentConfig[];
  /** Look up a CommandRunState by id (typically `store.commandRuns.get`). */
  getRun: (id: number) => CommandRunState | undefined;
}

/**
 * Top-level parser that translates raw input + agent catalogue into a tagged
 * decision. The thin wrapper in `sub-run.ts` pattern-matches on the result
 * and performs side effects (ui.notify, pi.sendMessage, spawn subagent, …).
 *
 * A returned `ambiguous-agent` still requires an interactive ui.select() —
 * the wrapper handles that, then calls `buildResolvedDecisionFromAgent` below.
 */
export function decideSubRun(
  rawInput: string | undefined | null,
  deps: SubRunDecisionDeps,
): SubRunDecision {
  if (isLegacyMainPrefix(rawInput)) return { kind: "legacy-main-prefix" };

  const parsed = parseSubRunArgs(rawInput);
  if (!parsed.input) return { kind: "empty-input" };

  if (deps.agents.length === 0) return { kind: "no-agents-found" };

  // ── continuation path (first token is a numeric run id and matches a run) ──
  if (parsed.isNumericFirstToken) {
    const targetRunId = Number(parsed.firstToken);
    const targetRun = deps.getRun(targetRunId);
    if (targetRun) {
      // parsed.rest is undefined iff firstSpace === -1 (parseSubRunArgs invariant).
      if (parsed.rest === undefined) return { kind: "usage-missing-task" };
      if (targetRun.status === "running") {
        return { kind: "continuation-target-running", targetRunId };
      }
      const nextInstruction = parsed.rest;

      const previousAgentName = targetRun.agent;
      const selectedAgent = resolveContinuationAgent(deps.agents, previousAgentName);
      if (!agentExists(deps.agents, selectedAgent)) {
        return { kind: "continuation-target-unknown-agent", targetRunId, previousAgentName };
      }

      const taskForDisplay = formatContinuationDisplay(targetRunId, nextInstruction);
      const reusesSessionFile = Boolean(targetRun.sessionFile);
      if (reusesSessionFile) {
        return {
          kind: "continuation",
          targetRunId,
          selectedAgent,
          taskForDisplay,
          reusesSessionFile: true,
          taskForAgent: nextInstruction,
        };
      }
      // lastLine is required on CommandRunState, so it is always a string.
      const previousOutputRaw = (targetRun.lastOutput ?? targetRun.lastLine).trim();
      const taskForAgent = buildFallbackContinuationTask({
        targetRunId,
        selectedAgent,
        previousTask: targetRun.task,
        previousOutput: previousOutputRaw,
        nextInstruction,
      });
      return {
        kind: "continuation",
        targetRunId,
        selectedAgent,
        taskForDisplay,
        reusesSessionFile: false,
        taskForAgent,
      };
    }
    // Numeric first token but no such run → treat as a new-run dispatch, fall through.
  }

  // ── new-run dispatch (first token may be an agent token) ──
  const { matchedAgent, ambiguousAgents } = matchSubCommandAgent(deps.agents, parsed.firstToken);
  if (ambiguousAgents.length > 1) {
    return {
      kind: "ambiguous-agent",
      firstToken: parsed.firstToken,
      ambiguousAgents,
      taskProvided: parsed.firstSpace !== -1,
    };
  }

  const resolvedAgent = matchedAgent;
  // At this point:
  //   - If resolvedAgent is undefined, we use the full input (non-empty because
  //     we returned empty-input above).
  //   - If resolvedAgent is truthy and parsed.rest is undefined (no task), we
  //     bounce with usage.
  //   - Otherwise, parsed.rest is guaranteed non-empty by parseSubRunArgs.
  if (!resolvedAgent) {
    return {
      kind: "resolved",
      selectedAgent: "worker",
      taskForDisplay: parsed.input,
      taskForAgent: parsed.input,
    };
  }
  if (parsed.rest === undefined) return { kind: "usage-missing-task" };
  return {
    kind: "resolved",
    selectedAgent: resolvedAgent.name,
    taskForDisplay: parsed.rest,
    taskForAgent: parsed.rest,
  };
}

/**
 * Used after an interactive disambiguation — the wrapper asks the user to
 * pick one of the ambiguous agents, then synthesises a "resolved" decision
 * with the chosen agent name and the remainder as task.
 */
export function buildResolvedDecisionFromAgent(
  resolvedAgentName: string,
  rawInput: string | undefined | null,
): Extract<SubRunDecision, { kind: "resolved" }> | { kind: "usage-missing-task" } {
  const parsed = parseSubRunArgs(rawInput);
  // parseSubRunArgs guarantees rest is undefined iff firstSpace === -1, and
  // non-empty otherwise.
  if (parsed.rest === undefined) return { kind: "usage-missing-task" };
  return {
    kind: "resolved",
    selectedAgent: resolvedAgentName,
    taskForDisplay: parsed.rest,
    taskForAgent: parsed.rest,
  };
}

// ━━━ Argument completions ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface CompletionItem {
  value: string;
  label: string;
  description?: string;
}

/**
 * Build the runId-continuation completions (the tail that augments the
 * agent-completion list for /sub:isolate and /sub:main).
 */
export function buildRunContinuationCompletions(
  runs: readonly CommandRunState[],
  argumentPrefix: string,
): CompletionItem[] {
  const trimmedStart = argumentPrefix.trimStart();
  if (trimmedStart.includes(" ")) return [];
  return [...runs]
    .sort((a, b) => b.id - a.id)
    .filter((run) => !trimmedStart || run.id.toString().startsWith(trimmedStart))
    .slice(0, COMMAND_COMPLETION_LIMIT)
    .map((run) => ({
      value: `${run.id} `,
      label: `${run.id}`,
      description: `continue ${run.agent}: ${truncateText(run.task, COMMAND_TASK_PREVIEW_CHARS)}`,
    }));
}

/**
 * Merge the run-continuation items with the agent items the way /sub:isolate
 * expects: runs first, then agents. Returns null when the merged list is empty
 * (pi convention for "no completions").
 */
export function mergeSubRunCompletions(
  runItems: CompletionItem[],
  agentItems: CompletionItem[],
  argumentPrefix: string,
): CompletionItem[] | null {
  const trimmedStart = argumentPrefix.trimStart();
  if (trimmedStart.includes(" ")) return null;
  const merged = [...runItems, ...agentItems];
  return merged.length > 0 ? merged : null;
}

// ━━━ Main-context wrapping ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface MainContextWrapInput {
  /** Rendered main session context text (possibly empty). */
  contextText: string;
  /** Total message count of the source session. */
  totalMessageCount: number;
  /** Sanitised main session file path. */
  mainSessionFile: string | undefined;
}

/**
 * Decide whether main-context wrapping should proceed, given the raw pieces
 * coming out of `buildMainContextText` + `getSessionFile`.
 *
 * Returns:
 *   - `{ apply: true, …}` if wrapping should happen
 *   - `{ apply: false, reason: "no-context" }` if neither context nor a session
 *     path exists (caller should notify + fall back to isolated mode)
 */
export type MainContextDecision =
  | { apply: true; contextText: string; mainSessionFile?: string; totalMessageCount: number }
  | { apply: false; reason: "no-context" };

export function decideMainContextWrap(input: MainContextWrapInput): MainContextDecision {
  if (input.contextText || input.mainSessionFile) {
    const decision: MainContextDecision = {
      apply: true,
      contextText: input.contextText,
      totalMessageCount: input.totalMessageCount,
    };
    if (input.mainSessionFile !== undefined) decision.mainSessionFile = input.mainSessionFile;
    return decision;
  }
  return { apply: false, reason: "no-context" };
}

/** Normalise a raw session-file string (strip CR/LF/TAB, trim). */
export function sanitiseSessionFilePath(raw: string | undefined | null): string | undefined {
  if (typeof raw !== "string") return undefined;
  const cleaned = raw.replace(/[\r\n\t]+/g, "").trim();
  return cleaned || undefined;
}

// ━━━ UX labels ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Human label used in /sub:isolate completion/notify text. */
export function contextModeLabel(mode: "main" | "isolated" | undefined): string {
  return mode === "main" ? "main context" : "dedicated sub-session";
}

export function startedStateLabel(continuedFromRunId: number | undefined): "resumed" | "started" {
  return continuedFromRunId !== undefined ? "resumed" : "started";
}

export const SUB_RUN_USAGE_TEXT =
  "Usage: /sub:main <agent|alias> <task> | /sub:main <runId> <task> | /sub:main <task> | /sub:isolate <agent|alias> <task> | /sub:isolate <runId> <task> | /sub:isolate <task>";

export const LEGACY_MAIN_PREFIX_WARNING =
  "'--main' 접두어는 사용할 수 없습니다. /sub:main 또는 /sub:isolate 명령 자체로 컨텍스트를 선택하세요.";

export const NO_AGENTS_FOUND_MESSAGE =
  "No subagents found. Checked user (~/.pi/agent/agents) + project-local (.pi/agents, .claude/agents).";

export function formatAmbiguousAgentMessage(
  token: string,
  ambiguousAgents: AgentConfig[],
  includeUsage: boolean,
): string {
  const names = ambiguousAgents.map((agent) => agent.name).join(", ");
  return includeUsage
    ? `${SUB_RUN_USAGE_TEXT}. Ambiguous agent alias "${token}": ${names}.`
    : `Ambiguous agent alias "${token}": ${names}. Use a longer alias or exact name.`;
}

export function formatContinuationUnknownAgentMessage(
  targetRunId: number,
  previousAgentName: string,
): string {
  return `Run #${targetRunId} references unknown agent "${previousAgentName}". Use /sub:main <agent> <task> instead.`;
}
