import { describe, expect, it } from "vitest";
import { formatRunTrees, isRunTree, resultToRunTree, statusForResult } from "../src/run-tree.js";

describe("run-tree", () => {
	it("maps run result status variants", () => {
		expect(statusForResult({})).toBe("ok");
		expect(statusForResult({ error: "boom" })).toBe("error");
		expect(statusForResult({ escalation: "need input" })).toBe("escalation");
	});

	it("builds a run tree from a run result", () => {
		const tree = resultToRunTree({
			id: 1,
			agent: "worker",
			task: "implement",
			output: "all done",
			usage: { inputTokens: 1, outputTokens: 2, turns: 1 },
			stopReason: "stop",
			runTrees: [{ id: 2, agent: "reviewer", status: "ok" }],
		});
		expect(tree).toEqual({
			id: 1,
			agent: "worker",
			task: "implement",
			status: "ok",
			stopReason: "stop",
			error: undefined,
			outputPreview: "all done",
			children: [{ id: 2, agent: "reviewer", status: "ok" }],
		});
	});

	it("formats run trees recursively", () => {
		const lines = formatRunTrees([
			{
				id: 1,
				agent: "worker",
				status: "ok",
				stopReason: "stop",
				children: [
					{ id: 2, agent: "reviewer", task: "review", status: "escalation", outputPreview: "need answer" },
					{ id: 3, agent: "verifier", status: "error", error: "broken" },
				],
			},
		]);
		expect(lines[0]).toContain("✓ worker #1");
		expect(lines[0]).toContain("(stop)");
		expect(lines[1]).toContain("⚠ reviewer #2");
		expect(lines[1]).toContain("review");
		expect(lines[1]).toContain("need answer");
		expect(lines[2]).toContain("✗ verifier #3");
		expect(lines[2]).toContain("broken");
		expect(formatRunTrees(undefined)).toEqual([]);
	});

	it("validates serialized run trees", () => {
		expect(isRunTree({ id: 1, agent: "worker", status: "ok" })).toBe(true);
		expect(isRunTree({ id: 1, agent: "worker", status: "ok", children: [{ id: 2, agent: "reviewer", status: "error", error: "boom" }] })).toBe(true);
		expect(isRunTree(null)).toBe(false);
		expect(isRunTree({ agent: "worker", status: "ok" })).toBe(false);
		expect(isRunTree({ id: 1, agent: "worker", status: "bad" })).toBe(false);
		expect(isRunTree({ id: 1, agent: "worker", status: "ok", children: "bad" })).toBe(false);
		expect(isRunTree({ id: 1, agent: "worker", status: "ok", children: [{ id: "x", agent: "bad", status: "ok" }] })).toBe(false);
		expect(isRunTree({ id: 1, agent: "worker", status: "ok", task: 1 })).toBe(false);
		expect(isRunTree({ id: 1, agent: "worker", status: "ok", stopReason: 1 })).toBe(false);
		expect(isRunTree({ id: 1, agent: "worker", status: "ok", error: 1 })).toBe(false);
		expect(isRunTree({ id: 1, agent: "worker", status: "ok", outputPreview: 1 })).toBe(false);
	});
});
