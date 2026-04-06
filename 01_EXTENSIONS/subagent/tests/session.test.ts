import { describe, it, expect, beforeEach } from "vitest";
import { sessionPath, buildRunsEntry, restoreRuns, getRunHistory, getSessionFile, resetSession, addToHistory } from "../src/session.js";

describe("sessionPath", () => {
	it("generates path from id", () => {
		const p = sessionPath(1, "/home/user");
		expect(p).toContain("subagents");
		expect(p).toContain("run-1");
		expect(p).toMatch(/\.json$/);
	});
});

describe("addToHistory", () => {
	beforeEach(() => resetSession());
	it("adds item to history", () => {
		addToHistory({ id: 1, agent: "scout" });
		expect(getRunHistory()).toHaveLength(1);
	});
});

describe("entry persistence", () => {
	beforeEach(() => resetSession());
	it("buildRunsEntry captures history", () => {
		addToHistory({ id: 1, agent: "scout" });
		const entry = buildRunsEntry();
		expect(entry.runs).toHaveLength(1);
		expect(entry.updatedAt).toBeGreaterThan(0);
	});
	it("restoreRuns from custom entries", () => {
		restoreRuns([{
			type: "custom", customType: "subagent-runs",
			data: { runs: [{ id: 1, agent: "scout", output: "ok", sessionFile: "/tmp/1.json" }], updatedAt: 0 },
		}]);
		expect(getRunHistory()).toHaveLength(1);
		expect(getRunHistory()[0].agent).toBe("scout");
	});
	it("takes last entry", () => {
		restoreRuns([
			{ type: "custom", customType: "subagent-runs", data: { runs: [{ id: 1, agent: "a" }], updatedAt: 0 } },
			{ type: "custom", customType: "subagent-runs", data: { runs: [{ id: 2, agent: "b" }], updatedAt: 1 } },
		]);
		expect(getRunHistory()[0].agent).toBe("b");
	});
	it("skips non-subagent entries", () => {
		restoreRuns([{ type: "custom", customType: "other" }, { type: "message" }]);
		expect(getRunHistory()).toEqual([]);
	});
	it("handles missing data", () => {
		restoreRuns([{ type: "custom", customType: "subagent-runs" }]);
		expect(getRunHistory()).toEqual([]);
	});
	it("handles data without runs", () => {
		restoreRuns([{ type: "custom", customType: "subagent-runs", data: { other: true } }]);
		expect(getRunHistory()).toEqual([]);
	});
});

describe("getSessionFile", () => {
	beforeEach(() => resetSession());
	it("returns session file for existing run", () => {
		addToHistory({ id: 1, agent: "scout", sessionFile: "/tmp/s.json" });
		expect(getSessionFile(1)).toBe("/tmp/s.json");
	});
	it("returns undefined for missing run", () => {
		expect(getSessionFile(999)).toBeUndefined();
	});
	it("returns undefined when no session file", () => {
		addToHistory({ id: 2, agent: "scout" });
		expect(getSessionFile(2)).toBeUndefined();
	});
});
