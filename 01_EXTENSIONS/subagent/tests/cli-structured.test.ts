import { describe, expect, it } from "vitest";
import { normalizeInput, parseCommand, stringifyCommand, subcommandToInput } from "../src/cli.js";

describe("structured cli helpers", () => {
	it("normalizes structured batch and chain input", () => {
		expect(normalizeInput({ type: "batch", items: [{ agent: "reviewer", task: "Review current auth flow" }, { agent: "verifier", task: "Verify tests still pass" }] }))
			.toEqual({ type: "batch", items: [{ agent: "reviewer", task: "Review current auth flow" }, { agent: "verifier", task: "Verify tests still pass" }], main: false });
		expect(normalizeInput(JSON.parse('{"type":"batch"}'))).toEqual({ type: "batch", items: [], main: false });
		expect(normalizeInput(JSON.parse('{"type":"chain"}'))).toEqual({ type: "chain", steps: [], main: false });
	});

	it("round-trips subcommands through structured input", () => {
		const cmd = parseCommand("chain --agent scout --task 'find auth entrypoint' --agent worker --task 'implement fix'");
		expect(normalizeInput(subcommandToInput(cmd))).toEqual(cmd);
		expect(stringifyCommand(cmd)).toContain("--task \"find auth entrypoint\"");
	});

	it("converts run and control commands", () => {
		expect(subcommandToInput({ type: "run", agent: "worker", task: "Implement fix", main: true, cwd: "/tmp/worktree" }))
			.toEqual({ type: "run", agent: "worker", task: "Implement fix", main: true, cwd: "/tmp/worktree" });
		expect(subcommandToInput({ type: "batch", items: [{ agent: "reviewer", task: "Review auth changes" }], main: false }))
			.toEqual({ type: "batch", items: [{ agent: "reviewer", task: "Review auth changes" }] });
		expect(subcommandToInput({ type: "batch", items: [{ agent: "reviewer", task: "Review auth changes" }], main: true }))
			.toEqual({ type: "batch", items: [{ agent: "reviewer", task: "Review auth changes" }], main: true });
		expect(subcommandToInput({ type: "chain", steps: [{ agent: "reviewer", task: "Review auth changes" }], main: true }))
			.toEqual({ type: "chain", steps: [{ agent: "reviewer", task: "Review auth changes" }], main: true });
		expect(subcommandToInput({ type: "continue", id: 3, task: "Need more context" })).toEqual({ type: "continue", id: 3, task: "Need more context" });
		expect(subcommandToInput({ type: "abort", id: 4 })).toEqual({ type: "abort", id: 4 });
		expect(subcommandToInput({ type: "detail", id: 5 })).toEqual({ type: "detail", id: 5 });
		expect(subcommandToInput({ type: "runs" })).toEqual({ type: "runs" });
	});

	it("stringifies structured commands", () => {
		expect(stringifyCommand({ type: "run", agent: "worker", task: "Implement fix", main: true, cwd: "/tmp/worktree" })).toBe('run worker --main --cwd "/tmp/worktree" -- Implement fix');
		expect(stringifyCommand({ type: "run", agent: "worker", task: "Implement fix", main: false })).toBe("run worker -- Implement fix");
		expect(stringifyCommand({ type: "batch", items: [{ agent: "reviewer", task: "Review auth changes" }], main: false })).toContain("batch");
		expect(stringifyCommand({ type: "batch", items: [{ agent: "reviewer", task: "Review auth changes" }], main: true })).toContain("--main");
		expect(stringifyCommand({ type: "chain", steps: [{ agent: "reviewer", task: "Review auth changes" }], main: true })).toContain("--main");
		expect(stringifyCommand({ type: "continue", id: 3, task: "Need more context" })).toBe("continue 3 -- Need more context");
		expect(stringifyCommand({ type: "abort", id: 4 })).toBe("abort 4");
		expect(stringifyCommand({ type: "detail", id: 5 })).toBe("detail 5");
		expect(stringifyCommand({ type: "runs" })).toBe("runs");
	});

	it("rejects invalid structured input", () => {
		expect(() => normalizeInput(JSON.parse('{"nope":true}'))).toThrow("Invalid subagent input");
		expect(() => normalizeInput(JSON.parse('{"type":"wat"}'))).toThrow("Unknown subcommand: wat");
		expect(() => normalizeInput(JSON.parse('{"type":null}'))).toThrow("Unknown subcommand: ");
	});
});
