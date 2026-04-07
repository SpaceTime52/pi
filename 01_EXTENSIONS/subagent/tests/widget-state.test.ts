import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	buildWidgetLines,
	clearToolState,
	resetWidgetState,
	setCurrentMessage,
	setCurrentTool,
	setNestedRuns,
} from "../src/widget.js";

beforeEach(() => resetWidgetState());

describe("setCurrentTool", () => {
	it("sets and clears tool name", () => {
		setCurrentTool(1, "Edit");
		expect(buildWidgetLines([{ id: 1, agent: "a", startedAt: 0 }], Date.now())[0]).toContain("Edit");
		setCurrentTool(1, undefined);
		expect(buildWidgetLines([{ id: 1, agent: "a", startedAt: 0 }], Date.now())[0]).not.toContain("Edit");
	});
	it("stores preview when provided", () => {
		setCurrentTool(1, "bash", "git status");
		const lines = buildWidgetLines([{ id: 1, agent: "a", startedAt: Date.now() }], Date.now());
		expect(lines[0]).toContain("bash: git status");
	});
	it("truncates preview to 30 chars", () => {
		const long = "a".repeat(50);
		setCurrentTool(1, "read", long);
		const lines = buildWidgetLines([{ id: 1, agent: "a", startedAt: Date.now() }], Date.now());
		expect(lines[0]).toContain("read: " + "a".repeat(29) + "…");
		expect(lines[0]).not.toContain("a".repeat(31));
	});
	it("updates lastEventTime so idle resets", () => {
		setCurrentTool(5, "Bash");
		vi.spyOn(Date, "now").mockReturnValue(60_000);
		setCurrentTool(5, "Read");
		vi.restoreAllMocks();
		expect(buildWidgetLines([{ id: 5, agent: "a", startedAt: 0 }], 120_000)[0]).not.toContain("⏸");
	});
	it("clears message preview when undefined", () => {
		setCurrentMessage(6, "draft");
		setCurrentMessage(6, undefined);
		expect(buildWidgetLines([{ id: 6, agent: "a", startedAt: Date.now() }], Date.now())[0]).not.toContain("reply:");
	});
});

describe("setNestedRuns", () => {
	it("clears nested state when undefined", () => {
		setNestedRuns(1, [{ id: 2, agent: "worker", startedAt: 0, depth: 1 }]);
		setNestedRuns(1, undefined);
		expect(buildWidgetLines([{ id: 1, agent: "a", startedAt: 0 }], Date.now())).toHaveLength(1);
	});
	it("clears nested state when empty", () => {
		setNestedRuns(1, [{ id: 2, agent: "worker", startedAt: 0, depth: 1 }]);
		setNestedRuns(1, []);
		expect(buildWidgetLines([{ id: 1, agent: "a", startedAt: 0 }], Date.now())).toHaveLength(1);
	});
});

describe("clearToolState", () => {
	it("removes both tool and lastEventTime", () => {
		setCurrentTool(3, "Bash");
		clearToolState(3);
		const lines = buildWidgetLines([{ id: 3, agent: "a", startedAt: 0 }], 250_000);
		expect(lines[0]).toContain("⏸");
		expect(lines[0]).not.toContain("→");
	});
});

describe("resetWidgetState", () => {
	it("clears all tool state", () => {
		setCurrentTool(1, "Bash");
		setCurrentTool(2, "Read");
		resetWidgetState();
		expect(buildWidgetLines([{ id: 1, agent: "a", startedAt: 0 }], Date.now())[0]).not.toContain("→");
	});
	it("resets frame counter", () => {
		const run = [{ id: 1, agent: "a", startedAt: Date.now() }];
		const now = Date.now();
		const first = buildWidgetLines(run, now)[0][0];
		resetWidgetState();
		const second = buildWidgetLines(run, now)[0][0];
		expect(first).toBe(second);
	});
});
