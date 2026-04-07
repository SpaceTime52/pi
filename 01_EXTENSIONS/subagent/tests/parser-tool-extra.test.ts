import { describe, it, expect } from "vitest";
import { parseLine } from "../src/parser.js";

describe("parseLine extra tool and agent events", () => {
	it("parses tool execution variants", () => {
		expect(parseLine(JSON.stringify({ type: "tool_execution_start", toolName: "bash", args: "echo hi" }))).toEqual({ type: "tool_start", toolName: "bash", text: "echo hi" });
		expect(parseLine(JSON.stringify({ type: "tool_execution_start", args: "echo hi" }))).toEqual({ type: "tool_start", toolName: undefined, text: "echo hi" });
		expect(parseLine(JSON.stringify({ type: "tool_execution_start", toolName: "x", args: { other: true } }))?.text).toContain("other");
		expect(parseLine(JSON.stringify({ type: "tool_execution_update", toolName: "bash", partialResult: { content: [{ type: "text", text: "partial output" }] } }))).toEqual({ type: "tool_update", toolName: "bash", text: "partial output" });
		expect(parseLine(JSON.stringify({ type: "tool_execution_update", toolName: "bash", partialResult: "raw output" }))).toEqual({ type: "tool_update", toolName: "bash", text: "raw output" });
		expect(parseLine(JSON.stringify({ type: "tool_execution_update", toolName: "bash", partialResult: { details: {} } }))).toEqual({ type: "tool_update", toolName: "bash", text: "" });
		expect(parseLine(JSON.stringify({ type: "tool_execution_update", toolName: "subagent", partialResult: { details: { activeRuns: [{ id: 2, agent: "worker", startedAt: 10, depth: 1 }] } } }))).toEqual({
			type: "tool_update",
			toolName: "subagent",
			text: "",
			nestedRuns: [{ id: 2, agent: "worker", startedAt: 10, depth: 1 }],
		});
		expect(parseLine(JSON.stringify({
			type: "tool_execution_end",
			toolName: "subagent",
			result: {
				content: [{ type: "text", text: "done" }],
				details: { runTrees: [{ id: 2, agent: "worker", status: "ok", children: [{ id: 3, agent: "verifier", status: "error", error: "boom" }] }] },
			},
		}))).toEqual({
			type: "tool_end",
			toolName: "subagent",
			text: "done",
			isError: false,
			runTrees: [{ id: 2, agent: "worker", status: "ok", children: [{ id: 3, agent: "verifier", status: "error", error: "boom" }] }],
		});
		expect(parseLine(JSON.stringify({ type: "tool_execution_end", toolName: "read", isError: true, result: { content: [{ type: "text", text: "missing" }] } }))).toEqual({ type: "tool_end", toolName: "read", text: "missing", isError: true });
	});

	it("ignores invalid nested run metadata", () => {
		expect(parseLine(JSON.stringify({ type: "tool_execution_update", toolName: "subagent", partialResult: { details: { activeRuns: [{ id: "bad", agent: "worker", startedAt: 10, depth: 1 }] } } }))).toEqual({
			type: "tool_update",
			toolName: "subagent",
			text: "",
		});
		expect(parseLine(JSON.stringify({ type: "tool_execution_update", toolName: "subagent", partialResult: { details: { activeRuns: [42] } } }))).toEqual({
			type: "tool_update",
			toolName: "subagent",
			text: "",
		});
		expect(parseLine(JSON.stringify({ type: "tool_execution_update", toolName: "subagent", partialResult: { details: { activeRuns: [{ id: 2, agent: "worker", startedAt: 10, depth: 1, task: 7 }] } } }))).toEqual({
			type: "tool_update",
			toolName: "subagent",
			text: "",
		});
		expect(parseLine(JSON.stringify({ type: "tool_execution_update", toolName: "subagent", partialResult: { details: { activeRuns: [{ id: 2, agent: "worker", startedAt: 10, depth: 1, activity: 7 }] } } }))).toEqual({
			type: "tool_update",
			toolName: "subagent",
			text: "",
		});
		expect(parseLine(JSON.stringify({ type: "tool_execution_update", toolName: "subagent", partialResult: { details: { activeRuns: [{ id: 2, agent: "worker", startedAt: 10, depth: 1, lastEventAt: "late" }] } } }))).toEqual({
			type: "tool_update",
			toolName: "subagent",
			text: "",
		});
		expect(parseLine(JSON.stringify({ type: "tool_execution_end", toolName: "subagent", result: { details: { runTrees: [{ id: 2, agent: "worker", status: "broken" }] } } }))).toEqual({
			type: "tool_end",
			toolName: "subagent",
			text: "",
			isError: false,
		});
	});

	it("parses agent_end fallback messages", () => {
		expect(parseLine(JSON.stringify({ type: "agent_end", messages: [{ role: "assistant", content: [{ type: "text", text: "final" }], stopReason: "stop", usage: { inputTokens: 1, outputTokens: 2 } }] }))).toEqual({ type: "agent_end", text: "final", usage: { inputTokens: 1, outputTokens: 2, turns: 1 }, stopReason: "stop" });
		expect(parseLine(JSON.stringify({ type: "agent_end", messages: [{ role: "user", content: [] }] }))).toEqual({ type: "agent_end", text: "", usage: undefined, stopReason: undefined });
		expect(parseLine(JSON.stringify({ type: "agent_end" }))).toEqual({ type: "agent_end", text: "", usage: undefined, stopReason: undefined });
		expect(parseLine(JSON.stringify({ type: 42 }))).toBeNull();
	});
});
