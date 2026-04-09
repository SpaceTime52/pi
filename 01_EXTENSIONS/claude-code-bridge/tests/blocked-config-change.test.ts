import { describe, expect, it } from "vitest";
import { diffSnapshots } from "../src/runtime/watch-scan.js";
import { restoreBlockedSnapshotPaths } from "../src/runtime/watch.js";

describe("claude bridge blocked config snapshots", () => {
	it("restores blocked paths so the next tick can detect the same add or change again", () => {
		const addedPath = "/repo/.claude/settings.json";
		const addedBefore = new Map<string, string>();
		const addedNext = new Map([[addedPath, "f:10:1"]]);
		const restoredAdd = restoreBlockedSnapshotPaths(addedBefore, addedNext, [addedPath]);
		expect(restoredAdd.has(addedPath)).toBe(false);
		expect(diffSnapshots(restoredAdd, addedNext)).toEqual([{ path: addedPath, event: "add" }]);

		const changedPath = "/repo/CLAUDE.md";
		const changedBefore = new Map([[changedPath, "f:10:1"]]);
		const changedNext = new Map([[changedPath, "f:11:2"]]);
		const restoredChange = restoreBlockedSnapshotPaths(changedBefore, changedNext, [changedPath]);
		expect(restoredChange.get(changedPath)).toBe("f:10:1");
		expect(diffSnapshots(restoredChange, changedNext)).toEqual([{ path: changedPath, event: "change" }]);
	});
});
