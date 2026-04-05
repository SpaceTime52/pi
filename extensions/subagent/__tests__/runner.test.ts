import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AssistantMessage, Message, ToolResultMessage } from "@mariozechner/pi-ai";
import type { SingleResult } from "../core/types.js";
import {
  appendStderrDiagnostic,
  createRunnerState,
  type PiJsonEvent,
  parsePiEventLine,
  processPiEvent,
  type RunnerState,
} from "../execution/runner-events.js";

// ━━━ Helpers ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function makeResult(overrides: Partial<SingleResult> = {}): SingleResult {
  return {
    agent: "worker",
    agentSource: "user",
    task: "do something",
    exitCode: 0,
    messages: [],
    stderr: "",
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      cost: 0,
      contextTokens: 0,
      turns: 0,
    },
    ...overrides,
  };
}

function makeState(overrides: Partial<SingleResult> = {}): RunnerState {
  return createRunnerState(makeResult(overrides), 1_000);
}

function makeAssistantMessage(
  content: AssistantMessage["content"],
  overrides: Partial<AssistantMessage> = {},
): AssistantMessage {
  return {
    role: "assistant",
    content,
    api: "anthropic-messages",
    provider: "anthropic",
    model: "claude-test",
    usage: {
      input: 10,
      output: 20,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 30,
      cost: { input: 0.001, output: 0.002, cacheRead: 0, cacheWrite: 0, total: 0.003 },
    },
    stopReason: "stop",
    timestamp: 1_000,
    ...overrides,
  };
}

function makeToolResultMessage(overrides: Partial<ToolResultMessage> = {}): ToolResultMessage {
  return {
    role: "toolResult",
    toolCallId: "call-1",
    toolName: "bash",
    content: [{ type: "text", text: "ok" }],
    isError: false,
    timestamp: 1_000,
    ...overrides,
  };
}

// ━━━ createRunnerState ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("createRunnerState", () => {
  it("initializes with provided result and now, zeroes all counters", () => {
    const result = makeResult();
    const state = createRunnerState(result, 42_000);
    assert.equal(state.currentResult, result);
    assert.equal(state.sawAgentEnd, false);
    assert.equal(state.lastEventAt, 42_000);
    assert.equal(state.unparsedStdoutCount, 0);
    assert.deepStrictEqual(state.unparsedStdoutTail, []);
  });
});

// ━━━ appendStderrDiagnostic ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("appendStderrDiagnostic", () => {
  it("initializes stderr when empty", () => {
    const result = makeResult({ stderr: "" });
    appendStderrDiagnostic(result, "hello");
    assert.equal(result.stderr, "[runner] hello\n");
  });

  it("appends to existing stderr trimmed", () => {
    const result = makeResult({ stderr: "prev line\n\n\n" });
    appendStderrDiagnostic(result, "next");
    assert.equal(result.stderr, "prev line\n[runner] next\n");
  });
});

// ━━━ parsePiEventLine ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("parsePiEventLine", () => {
  it("returns null for blank lines without mutating state", () => {
    const state = makeState();
    assert.equal(parsePiEventLine("", state), null);
    assert.equal(parsePiEventLine("   \t  ", state), null);
    assert.equal(state.unparsedStdoutCount, 0);
    assert.deepStrictEqual(state.unparsedStdoutTail, []);
  });

  it("parses valid JSON events", () => {
    const state = makeState();
    const event = parsePiEventLine('{"type":"agent_start"}', state);
    assert.deepStrictEqual(event, { type: "agent_start" });
    assert.equal(state.unparsedStdoutCount, 0);
  });

  it("captures unparsed lines into tail (bounded to 3)", () => {
    const state = makeState();
    parsePiEventLine("not json 1", state);
    parsePiEventLine("not json 2", state);
    parsePiEventLine("not json 3", state);
    parsePiEventLine("not json 4", state);
    assert.equal(state.unparsedStdoutCount, 4);
    assert.deepStrictEqual(state.unparsedStdoutTail, ["not json 2", "not json 3", "not json 4"]);
  });

  it("truncates snippets to 300 chars", () => {
    const state = makeState();
    const long = `x`.repeat(500);
    parsePiEventLine(long, state);
    assert.equal(state.unparsedStdoutCount, 1);
    assert.equal(state.unparsedStdoutTail[0]?.length, 300);
  });

  it("counts unparseable whitespace-wrapped junk but skips empty snippet", () => {
    const state = makeState();
    // Line is not blank (has a char) but after trim still has something; we
    // need a case where trim() returns empty to skip snippet push. Blank lines
    // return null earlier. Whitespace-only lines also return null earlier. So
    // we exercise the "snippet truthy" branch with non-empty junk here.
    parsePiEventLine("{", state);
    assert.equal(state.unparsedStdoutCount, 1);
    assert.deepStrictEqual(state.unparsedStdoutTail, ["{"]);
  });
});

// ━━━ processPiEvent — agent_start / turn_start ━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("processPiEvent — lifecycle markers", () => {
  const cases: Array<{ label: string; type: string }> = [
    { label: "agent_start resets sawAgentEnd", type: "agent_start" },
    { label: "turn_start resets sawAgentEnd", type: "turn_start" },
  ];

  for (const { label, type } of cases) {
    it(label, () => {
      const state = makeState();
      state.sawAgentEnd = true;
      const effects = processPiEvent({ type }, state, 5_000);
      assert.equal(state.sawAgentEnd, false);
      assert.equal(state.lastEventAt, 5_000);
      assert.deepStrictEqual(effects, { emitUpdate: false, scheduleForceResolve: false });
    });
  }

  it("unknown event types just update lastEventAt and propagate sawAgentEnd", () => {
    const state = makeState();
    state.sawAgentEnd = true;
    const effects = processPiEvent({ type: "whatever_else" }, state, 7_000);
    assert.equal(state.lastEventAt, 7_000);
    assert.deepStrictEqual(effects, { emitUpdate: false, scheduleForceResolve: true });
  });

  it("unknown event returns scheduleForceResolve=false when sawAgentEnd is false", () => {
    const state = makeState();
    const effects = processPiEvent({ type: "whatever_else" }, state, 7_000);
    assert.deepStrictEqual(effects, { emitUpdate: false, scheduleForceResolve: false });
  });
});

// ━━━ processPiEvent — agent_end (bug-fix path) ━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("processPiEvent — agent_end", () => {
  it("recovers stopReason and errorMessage from messages when present", () => {
    const state = makeState();
    const msg: Message = makeAssistantMessage([{ type: "text", text: "bye" }], {
      stopReason: "error",
      errorMessage: "rate limited",
    });
    const effects = processPiEvent({ type: "agent_end", messages: [msg] }, state, 9_000);

    assert.equal(state.sawAgentEnd, true);
    assert.equal(state.currentResult.stopReason, "error");
    assert.equal(state.currentResult.errorMessage, "rate limited");
    assert.equal(state.currentResult.messages.length, 1);
    assert.equal(state.currentResult.messages[0], msg);
    assert.deepStrictEqual(effects, { emitUpdate: false, scheduleForceResolve: true });
  });

  it("does not overwrite stopReason that was already set earlier", () => {
    const state = makeState();
    state.currentResult.stopReason = "stop";
    state.currentResult.errorMessage = "existing";
    const msg: Message = makeAssistantMessage([], {
      stopReason: "error",
      errorMessage: "later error",
    });
    processPiEvent({ type: "agent_end", messages: [msg] }, state, 9_000);
    assert.equal(state.currentResult.stopReason, "stop");
    assert.equal(state.currentResult.errorMessage, "existing");
  });

  it("ignores assistant messages with no stopReason (falsy guard)", () => {
    const state = makeState();
    const msg: Message = makeAssistantMessage([], { stopReason: "" as "stop" });
    processPiEvent({ type: "agent_end", messages: [msg] }, state, 9_000);
    assert.equal(state.currentResult.stopReason, undefined);
    assert.equal(state.currentResult.messages.length, 1);
  });

  it("recovers stopReason without errorMessage when assistant has none", () => {
    const state = makeState();
    const msg: Message = makeAssistantMessage([], { stopReason: "aborted" });
    // errorMessage intentionally omitted to exercise the !errorMessage branch.
    processPiEvent({ type: "agent_end", messages: [msg] }, state, 9_000);
    assert.equal(state.currentResult.stopReason, "aborted");
    assert.equal(state.currentResult.errorMessage, undefined);
  });

  it("handles missing messages field (empty array)", () => {
    const state = makeState();
    const effects = processPiEvent({ type: "agent_end" }, state, 9_000);
    assert.equal(state.sawAgentEnd, true);
    assert.equal(state.currentResult.messages.length, 0);
    assert.equal(state.currentResult.stopReason, undefined);
    assert.deepStrictEqual(effects, { emitUpdate: false, scheduleForceResolve: true });
  });

  it("handles explicitly empty messages", () => {
    const state = makeState();
    processPiEvent({ type: "agent_end", messages: [] }, state, 9_000);
    assert.equal(state.sawAgentEnd, true);
    assert.equal(state.currentResult.messages.length, 0);
  });

  it("skips duplicate messages by reference equality", () => {
    const state = makeState();
    const msg: Message = makeAssistantMessage([{ type: "text", text: "once" }], {
      stopReason: "stop",
    });
    state.currentResult.messages.push(msg);
    processPiEvent({ type: "agent_end", messages: [msg] }, state, 9_000);
    assert.equal(state.currentResult.messages.length, 1);
  });

  it("ignores non-assistant messages for stopReason but still pushes them", () => {
    const state = makeState();
    const toolMsg: Message = makeToolResultMessage();
    processPiEvent({ type: "agent_end", messages: [toolMsg] }, state, 9_000);
    assert.equal(state.currentResult.messages.length, 1);
    assert.equal(state.currentResult.stopReason, undefined);
  });
});

// ━━━ processPiEvent — message_update ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("processPiEvent — message_update", () => {
  it("accumulates liveText from text_delta chunks", () => {
    const state = makeState();
    processPiEvent(
      {
        type: "message_update",
        assistantMessageEvent: { type: "text_delta", delta: "Hel" },
      },
      state,
      1_100,
    );
    processPiEvent(
      {
        type: "message_update",
        assistantMessageEvent: { type: "text_delta", delta: "lo!" },
      },
      state,
      1_200,
    );
    assert.equal(state.currentResult.liveText, "Hello!");
  });

  it("requests emitUpdate when chunk is non-empty", () => {
    const state = makeState();
    const effects = processPiEvent(
      {
        type: "message_update",
        assistantMessageEvent: { type: "text_delta", delta: "x" },
      },
      state,
      1_100,
    );
    assert.deepStrictEqual(effects, { emitUpdate: true, scheduleForceResolve: false });
  });

  it("ignores empty text_delta chunks", () => {
    const state = makeState();
    const effects = processPiEvent(
      {
        type: "message_update",
        assistantMessageEvent: { type: "text_delta", delta: "" },
      },
      state,
      1_100,
    );
    assert.equal(state.currentResult.liveText, undefined);
    assert.deepStrictEqual(effects, { emitUpdate: false, scheduleForceResolve: false });
  });

  it("ignores text_delta with non-string delta", () => {
    const state = makeState();
    const effects = processPiEvent(
      {
        type: "message_update",
        assistantMessageEvent: { type: "text_delta" },
      },
      state,
      1_100,
    );
    assert.equal(state.currentResult.liveText, undefined);
    assert.deepStrictEqual(effects, { emitUpdate: false, scheduleForceResolve: false });
  });

  it("ignores non-text_delta subtypes", () => {
    const state = makeState();
    const effects = processPiEvent(
      {
        type: "message_update",
        assistantMessageEvent: { type: "thinking_delta", delta: "thought" },
      },
      state,
      1_100,
    );
    assert.equal(state.currentResult.liveText, undefined);
    assert.deepStrictEqual(effects, { emitUpdate: false, scheduleForceResolve: false });
  });

  it("ignores message_update without assistantMessageEvent", () => {
    const state = makeState();
    const effects = processPiEvent({ type: "message_update" }, state, 1_100);
    assert.equal(state.currentResult.liveText, undefined);
    assert.deepStrictEqual(effects, { emitUpdate: false, scheduleForceResolve: false });
  });
});

// ━━━ processPiEvent — tool_execution_start ━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("processPiEvent — tool_execution_start", () => {
  it("increments liveToolCalls from undefined", () => {
    const state = makeState();
    const effects = processPiEvent({ type: "tool_execution_start" }, state, 2_000);
    assert.equal(state.currentResult.liveToolCalls, 1);
    assert.deepStrictEqual(effects, { emitUpdate: true, scheduleForceResolve: false });
  });

  it("increments an existing liveToolCalls counter", () => {
    const state = makeState();
    state.currentResult.liveToolCalls = 4;
    processPiEvent({ type: "tool_execution_start" }, state, 2_000);
    assert.equal(state.currentResult.liveToolCalls, 5);
  });
});

// ━━━ processPiEvent — message_end ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("processPiEvent — message_end", () => {
  it("pushes assistant message, updates usage and stopReason", () => {
    const state = makeState();
    state.currentResult.liveText = "streaming text";
    const msg = makeAssistantMessage([{ type: "text", text: "done" }], {
      stopReason: "stop",
    });
    const effects = processPiEvent({ type: "message_end", message: msg }, state, 3_000);

    assert.equal(state.currentResult.messages.length, 1);
    assert.equal(state.currentResult.messages[0], msg);
    assert.equal(state.currentResult.liveText, undefined);
    assert.equal(state.currentResult.usage.turns, 1);
    assert.equal(state.currentResult.usage.input, 10);
    assert.equal(state.currentResult.usage.output, 20);
    assert.equal(state.currentResult.usage.contextTokens, 30);
    assert.equal(state.currentResult.usage.cost, 0.003);
    assert.equal(state.currentResult.model, "claude-test");
    assert.equal(state.currentResult.stopReason, "stop");
    assert.deepStrictEqual(effects, { emitUpdate: true, scheduleForceResolve: false });
  });

  it("propagates scheduleForceResolve when sawAgentEnd is already true", () => {
    const state = makeState();
    state.sawAgentEnd = true;
    const msg = makeAssistantMessage([{ type: "text", text: "late" }]);
    const effects = processPiEvent({ type: "message_end", message: msg }, state, 3_000);
    assert.deepStrictEqual(effects, { emitUpdate: true, scheduleForceResolve: true });
  });

  it("extracts thoughtText from thinking block (first non-empty line, markdown stripped)", () => {
    const state = makeState();
    const msg = makeAssistantMessage([
      {
        type: "thinking",
        thinking: "\n\n## **Analyzing** `input` data\nsecond line we ignore",
      },
      { type: "text", text: "reply" },
    ]);
    processPiEvent({ type: "message_end", message: msg }, state, 3_000);
    assert.equal(state.currentResult.thoughtText, "Analyzing input data");
  });

  it("truncates thoughtText to 80 chars", () => {
    const state = makeState();
    const long = "a".repeat(200);
    const msg = makeAssistantMessage([{ type: "thinking", thinking: long }]);
    processPiEvent({ type: "message_end", message: msg }, state, 3_000);
    assert.equal(state.currentResult.thoughtText?.length, 80);
  });

  it("ignores thinking blocks with only whitespace", () => {
    const state = makeState();
    const msg = makeAssistantMessage([{ type: "thinking", thinking: "   \n\n  \t\n" }]);
    processPiEvent({ type: "message_end", message: msg }, state, 3_000);
    assert.equal(state.currentResult.thoughtText, undefined);
  });

  it("ignores thinking blocks whose first line normalizes to empty after markdown strip", () => {
    const state = makeState();
    const msg = makeAssistantMessage([{ type: "thinking", thinking: "**  **" }]);
    processPiEvent({ type: "message_end", message: msg }, state, 3_000);
    assert.equal(state.currentResult.thoughtText, undefined);
  });

  it("falls back to empty string when thinking block lacks a thinking field", () => {
    const state = makeState();
    // Construct a thinking block missing the "thinking" field to exercise the
    // `"thinking" in part` guard branch.
    const msg = makeAssistantMessage([{ type: "thinking" } as AssistantMessage["content"][number]]);
    processPiEvent({ type: "message_end", message: msg }, state, 3_000);
    assert.equal(state.currentResult.thoughtText, undefined);
  });

  it("preserves existing model when message model is unset", () => {
    const state = makeState();
    state.currentResult.model = "existing-model";
    const msg = makeAssistantMessage([{ type: "text", text: "hi" }], { model: "new-model" });
    processPiEvent({ type: "message_end", message: msg }, state, 3_000);
    assert.equal(state.currentResult.model, "existing-model");
  });

  it("sets errorMessage when message has one", () => {
    const state = makeState();
    const msg = makeAssistantMessage([], {
      stopReason: "error",
      errorMessage: "boom",
    });
    processPiEvent({ type: "message_end", message: msg }, state, 3_000);
    assert.equal(state.currentResult.errorMessage, "boom");
  });

  it("handles assistant message with no usage safely (uses undefined-coerced values)", () => {
    const state = makeState();
    const msg = makeAssistantMessage([{ type: "text", text: "hi" }]);
    // Simulate missing usage via a clone without the field (production code
    // guards with `if (usage)` so runtime may see non-compliant payloads).
    const { usage: _removed, ...rest } = msg;
    const msgNoUsage = rest as AssistantMessage;
    processPiEvent({ type: "message_end", message: msgNoUsage }, state, 3_000);
    assert.equal(state.currentResult.usage.input, 0);
    assert.equal(state.currentResult.usage.output, 0);
    assert.equal(state.currentResult.usage.turns, 1);
  });

  it("uses 0 fallbacks when individual usage fields are missing", () => {
    const state = makeState();
    const msg = makeAssistantMessage([{ type: "text", text: "hi" }], {
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
    });
    processPiEvent({ type: "message_end", message: msg }, state, 3_000);
    assert.equal(state.currentResult.usage.input, 0);
    assert.equal(state.currentResult.usage.cacheRead, 0);
    assert.equal(state.currentResult.usage.cacheWrite, 0);
    assert.equal(state.currentResult.usage.cost, 0);
    assert.equal(state.currentResult.usage.contextTokens, 0);
  });

  it("handles usage with missing cost sub-object safely", () => {
    const state = makeState();
    const baseUsage = {
      input: 1,
      output: 2,
      cacheRead: 3,
      cacheWrite: 4,
      totalTokens: 10,
    };
    // Simulate a payload missing the nested cost object — production uses
    // `usage.cost?.total || 0` so this must not throw.
    const usageNoCost = baseUsage as AssistantMessage["usage"];
    const msg = makeAssistantMessage([{ type: "text", text: "hi" }], { usage: usageNoCost });
    processPiEvent({ type: "message_end", message: msg }, state, 3_000);
    assert.equal(state.currentResult.usage.cost, 0);
    assert.equal(state.currentResult.usage.contextTokens, 10);
  });

  it("handles message with no stopReason", () => {
    const state = makeState();
    const msg = makeAssistantMessage([{ type: "text", text: "hi" }], {
      stopReason: "" as "stop",
    });
    processPiEvent({ type: "message_end", message: msg }, state, 3_000);
    assert.equal(state.currentResult.stopReason, undefined);
  });

  it("does nothing for message_end without message field", () => {
    const state = makeState();
    const effects = processPiEvent({ type: "message_end" }, state, 3_000);
    assert.equal(state.currentResult.messages.length, 0);
    assert.deepStrictEqual(effects, { emitUpdate: false, scheduleForceResolve: false });
  });

  it("pushes but does not update usage for non-assistant messages", () => {
    const state = makeState();
    const toolMsg: Message = makeToolResultMessage();
    const effects = processPiEvent({ type: "message_end", message: toolMsg }, state, 3_000);
    assert.equal(state.currentResult.messages.length, 1);
    assert.equal(state.currentResult.usage.turns, 0);
    assert.deepStrictEqual(effects, { emitUpdate: true, scheduleForceResolve: false });
  });
});

// ━━━ processPiEvent — tool_result_end ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("processPiEvent — tool_result_end", () => {
  it("pushes the tool result message", () => {
    const state = makeState();
    const toolMsg: Message = makeToolResultMessage();
    const effects = processPiEvent({ type: "tool_result_end", message: toolMsg }, state, 4_000);
    assert.equal(state.currentResult.messages.length, 1);
    assert.equal(state.currentResult.messages[0], toolMsg);
    assert.deepStrictEqual(effects, { emitUpdate: true, scheduleForceResolve: false });
  });

  it("requests scheduleForceResolve when sawAgentEnd is already true", () => {
    const state = makeState();
    state.sawAgentEnd = true;
    const toolMsg: Message = makeToolResultMessage();
    const effects = processPiEvent({ type: "tool_result_end", message: toolMsg }, state, 4_000);
    assert.deepStrictEqual(effects, { emitUpdate: true, scheduleForceResolve: true });
  });

  it("does nothing for tool_result_end without a message", () => {
    const state = makeState();
    const effects = processPiEvent({ type: "tool_result_end" }, state, 4_000);
    assert.equal(state.currentResult.messages.length, 0);
    assert.deepStrictEqual(effects, { emitUpdate: false, scheduleForceResolve: false });
  });
});

// ━━━ processPiEvent — integration ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("processPiEvent — realistic full-turn sequence", () => {
  it("emits expected effects in order and ends with sawAgentEnd=true", () => {
    const state = makeState();
    const asstMsg = makeAssistantMessage([{ type: "text", text: "Hello world" }]);
    const events: PiJsonEvent[] = [
      { type: "agent_start" },
      { type: "turn_start" },
      { type: "message_update", assistantMessageEvent: { type: "text_delta", delta: "Hello " } },
      { type: "message_update", assistantMessageEvent: { type: "text_delta", delta: "world" } },
      { type: "tool_execution_start" },
      { type: "message_end", message: asstMsg },
      { type: "agent_end", messages: [asstMsg] },
    ];

    const effects = events.map((e, i) => processPiEvent(e, state, 10_000 + i));

    assert.deepStrictEqual(
      effects.map((e) => e.emitUpdate),
      [false, false, true, true, true, true, false],
    );
    assert.equal(state.sawAgentEnd, true);
    assert.equal(state.currentResult.messages.length, 1);
    assert.equal(state.currentResult.liveText, undefined);
    assert.equal(state.currentResult.liveToolCalls, 1);
    assert.equal(state.currentResult.usage.turns, 1);
    assert.equal(state.lastEventAt, 10_006);
  });
});
