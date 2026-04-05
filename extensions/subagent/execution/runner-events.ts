/**
 * Pure event-processing state machine for subagent stdout streams.
 *
 * Extracted from runner.ts so the logic that decodes `PiJsonEvent` streams —
 * including the documented "agent_end without message_end" bug-recovery path —
 * can be unit-tested without spawning a subprocess.
 */

import type { AssistantMessage, Message } from "@mariozechner/pi-ai";
import type { SingleResult } from "../core/types.js";

const UNPARSED_TAIL_MAX = 3;
const UNPARSED_SNIPPET_MAX = 300;
const THOUGHT_TEXT_MAX = 80;

export interface PiJsonEvent {
  type: string;
  messages?: Message[];
  message?: Message;
  assistantMessageEvent?: { type: string; delta?: string };
}

export interface RunnerState {
  currentResult: SingleResult;
  sawAgentEnd: boolean;
  lastEventAt: number;
  unparsedStdoutCount: number;
  unparsedStdoutTail: string[];
}

export interface ProcessEventEffects {
  emitUpdate: boolean;
  scheduleForceResolve: boolean;
}

export function createRunnerState(currentResult: SingleResult, now: number): RunnerState {
  return {
    currentResult,
    sawAgentEnd: false,
    lastEventAt: now,
    unparsedStdoutCount: 0,
    unparsedStdoutTail: [],
  };
}

export function appendStderrDiagnostic(result: SingleResult, message: string): void {
  const line = `[runner] ${message}`;
  result.stderr = result.stderr ? `${result.stderr.trimEnd()}\n${line}\n` : `${line}\n`;
}

/**
 * Parse a single stdout line as a pi JSON event.
 * Mutates `state.unparsedStdoutCount` / `state.unparsedStdoutTail` on parse failure.
 * Returns `null` for blank lines or parse failures.
 */
export function parsePiEventLine(line: string, state: RunnerState): PiJsonEvent | null {
  if (!line.trim()) return null;
  try {
    return JSON.parse(line) as PiJsonEvent;
  } catch {
    state.unparsedStdoutCount++;
    const snippet = line.trim().slice(0, UNPARSED_SNIPPET_MAX);
    if (snippet) {
      state.unparsedStdoutTail.push(snippet);
      if (state.unparsedStdoutTail.length > UNPARSED_TAIL_MAX) state.unparsedStdoutTail.shift();
    }
    return null;
  }
}

function extractThoughtText(content: AssistantMessage["content"]): string | undefined {
  for (const part of content) {
    if (part.type === "thinking") {
      const raw = "thinking" in part ? part.thinking : "";
      const firstLine = raw
        .split("\n")
        .map((l: string) => l.trim())
        .filter(Boolean)[0];
      if (firstLine) {
        // Strip markdown: **bold**, *italic*, `code`, # headers
        const clean = firstLine
          .replace(/^#+\s*/, "")
          .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
          .replace(/`([^`]+)`/g, "$1")
          .trim();
        if (clean) return clean.slice(0, THOUGHT_TEXT_MAX);
      }
    }
  }
  return undefined;
}

/**
 * Pure event state-transition. Mutates `state` in place and returns the
 * effects the caller should trigger (UI emit, force-resolve scheduling).
 *
 * Kept free of subprocess I/O so it is directly unit-testable.
 */
export function processPiEvent(
  event: PiJsonEvent,
  state: RunnerState,
  now: number,
): ProcessEventEffects {
  state.lastEventAt = now;
  const { currentResult } = state;

  if (event.type === "agent_start" || event.type === "turn_start") {
    state.sawAgentEnd = false;
    return { emitUpdate: false, scheduleForceResolve: false };
  }

  if (event.type === "agent_end") {
    // Bug fix: agent.js catch block emits agent_end without message_end on
    // rate-limit / abort / network errors, so stopReason is never set via
    // the message_end path. Recover it from event.messages directly.
    // CRITICAL: Must also add these messages to currentResult.messages,
    // otherwise getFinalOutput() returns "" and the task fails with "Output was empty".
    for (const msg of event.messages ?? []) {
      if (!currentResult.messages.find((m) => m === msg)) {
        currentResult.messages.push(msg);
      }
      if (msg.role === "assistant") {
        const assistantMsg: AssistantMessage = msg;
        if (assistantMsg.stopReason && !currentResult.stopReason) {
          currentResult.stopReason = assistantMsg.stopReason;
          if (assistantMsg.errorMessage) currentResult.errorMessage = assistantMsg.errorMessage;
        }
      }
    }
    state.sawAgentEnd = true;
    return { emitUpdate: false, scheduleForceResolve: true };
  }

  if (event.type === "message_update") {
    const delta = event.assistantMessageEvent;
    if (delta?.type === "text_delta") {
      const chunk = typeof delta.delta === "string" ? delta.delta : "";
      if (chunk) {
        currentResult.liveText = `${currentResult.liveText ?? ""}${chunk}`;
        return { emitUpdate: true, scheduleForceResolve: false };
      }
    }
    return { emitUpdate: false, scheduleForceResolve: false };
  }

  if (event.type === "tool_execution_start") {
    currentResult.liveToolCalls = (currentResult.liveToolCalls ?? 0) + 1;
    return { emitUpdate: true, scheduleForceResolve: false };
  }

  if (event.type === "message_end" && event.message) {
    const msg = event.message;
    currentResult.messages.push(msg);

    if (msg.role === "assistant") {
      currentResult.liveText = undefined;
      currentResult.usage.turns++;
      const usage = msg.usage;
      if (usage) {
        currentResult.usage.input += usage.input || 0;
        currentResult.usage.output += usage.output || 0;
        currentResult.usage.cacheRead += usage.cacheRead || 0;
        currentResult.usage.cacheWrite += usage.cacheWrite || 0;
        currentResult.usage.cost += usage.cost?.total || 0;
        currentResult.usage.contextTokens = usage.totalTokens || 0;
      }
      if (!currentResult.model && msg.model) currentResult.model = msg.model;
      if (msg.stopReason) currentResult.stopReason = msg.stopReason;
      if (msg.errorMessage) currentResult.errorMessage = msg.errorMessage;

      const thoughtText = extractThoughtText(msg.content);
      if (thoughtText) currentResult.thoughtText = thoughtText;
    }
    return { emitUpdate: true, scheduleForceResolve: state.sawAgentEnd };
  }

  if (event.type === "tool_result_end" && event.message) {
    currentResult.messages.push(event.message);
    return { emitUpdate: true, scheduleForceResolve: state.sawAgentEnd };
  }

  return { emitUpdate: false, scheduleForceResolve: state.sawAgentEnd };
}
