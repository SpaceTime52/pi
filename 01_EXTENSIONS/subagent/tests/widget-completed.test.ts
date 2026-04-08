import { describe, expect, it } from "vitest";
import { buildCompletedWidgetLines } from "../src/widget.js";

describe("completed widget lines", () => {
	it("formats completed success, error, and escalation states", () => {
		expect(buildCompletedWidgetLines({ id: 1, agent: "scout", task: "find auth", startedAt: 0, finishedAt: 3_000, status: "ok", summary: "stop" })[0]).toContain("✓ scout #1 — find auth (3s) — stop");
		expect(buildCompletedWidgetLines({ id: 2, agent: "worker", task: "fix auth", startedAt: 0, finishedAt: 65_000, status: "error", summary: "boom" })[0]).toContain("✗ worker #2 — fix auth (1m 5s) — boom");
		expect(buildCompletedWidgetLines({ id: 3, agent: "reviewer", startedAt: 0, finishedAt: 1_000, status: "escalation", summary: "need answer", runTrees: [{ id: 4, agent: "verifier", status: "ok" }] })).toEqual([
			"⚠ reviewer #3 (1s) — need answer",
			"  └─✓ verifier #4",
		]);
	});

	it("omits completed summary when absent and limits nested lines", () => {
		const lines = buildCompletedWidgetLines({
			id: 5,
			agent: "worker",
			startedAt: 0,
			finishedAt: 0,
			status: "ok",
			runTrees: [
				{ id: 6, agent: "a", status: "ok" },
				{ id: 7, agent: "b", status: "ok" },
				{ id: 8, agent: "c", status: "ok" },
				{ id: 9, agent: "d", status: "ok" },
				{ id: 10, agent: "e", status: "ok" },
			],
		});
		expect(lines[0]).toBe("✓ worker #5 (0s)");
		expect(lines).toHaveLength(5);
		expect(lines.join("\n")).not.toContain("e #10");
	});
});
