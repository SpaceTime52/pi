import { describe, expect, it } from "vitest";
import { applyUpdatedInput, toClaudeToolInput } from "../src/test-api.js";

describe("claude bridge tool mapping", () => {
	it("maps edit tool input into Claude Edit payload", () => {
		const mapped = toClaudeToolInput("edit", { path: "src/index.ts", edits: [{ oldText: "before", newText: "after" }] }, "/workspace/project");
		expect(mapped).toEqual({ tool_name: "Edit", tool_input: { file_path: "/workspace/project/src/index.ts", old_string: "before", new_string: "after", replace_all: undefined } });
	});

	it("maps grep options using pi's real input shape", () => {
		const mapped = toClaudeToolInput("grep", { pattern: "TODO", path: "src", glob: "*.ts", ignoreCase: true, literal: true, context: 2, limit: 5 }, "/workspace/project");
		expect(mapped).toEqual({ tool_name: "Grep", tool_input: { pattern: "TODO", path: "/workspace/project/src", glob: "*.ts", ignoreCase: true, literal: true, context: 2, limit: 5 } });
	});

	it("maps structured subagent input into Claude Agent payload", () => {
		const mapped = toClaudeToolInput("subagent", { type: "run", agent: "reviewer", task: "Review current auth diff" }, "/workspace/project");
		expect(mapped).toEqual({ tool_name: "Agent", tool_input: { prompt: "run reviewer -- Review current auth diff", subagent_type: "reviewer" } });
	});

	it("preserves full batch task details for Claude hooks", () => {
		const mapped = toClaudeToolInput("subagent", { type: "batch", items: [{ agent: "reviewer", task: "Review auth diff" }, { agent: "verifier", task: "Verify tests" }] }, "/workspace/project");
		expect(mapped).toEqual({ tool_name: "Agent", tool_input: { prompt: JSON.stringify({ type: "batch", items: [{ agent: "reviewer", task: "Review auth diff" }, { agent: "verifier", task: "Verify tests" }] }), subagent_type: undefined } });
	});

	it("applies updated Claude bash input back onto pi bash input", () => {
		const input = { command: "go test ./...", timeout: 5 };
		applyUpdatedInput("bash", input, { command: "make test", timeout: 12000 });
		expect(input).toEqual({ command: "make test", timeout: 12 });
	});
});
