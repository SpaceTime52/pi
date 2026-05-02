import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";
import { EXTENSION_ID, type TrackerState } from "../src/types.ts";
import { formatNotification, formatStatus, renderWidgetLines, syncTrackerUi } from "../src/ui.ts";

const state: TrackerState = {
	pr: {
		number: 63,
		title: "Add PR tracker",
		url: "https://github.com/acme/web/pull/63",
		changedFiles: 1,
		additions: 10,
		deletions: 2,
		headRefName: "feature/pr-tracker",
		baseRefName: "main",
		checks: { state: "passing", total: 3, passed: 3, pending: 0, failed: 0 },
		review: { state: "approved", label: "Review approved" },
		readiness: { state: "ready", label: "Ready to merge" },
		updatedAt: "now",
	},
};

describe("ui", () => {
	it("renders compact PR widget lines", () => {
		expect(renderWidgetLines(state)).toEqual([
			"#63 Ready to merge · Add PR tracker",
			"  Checks ✓ 3/3 · Review approved · Changes 1 · +10/-2 · feature/pr-tracker → main",
			"  /pr refresh · /pr open · /pr merge · /pr untrack",
		]);
		expect(formatStatus(state)).toBe("PR #63 Ready to merge");
		expect(formatNotification(state)).toContain("#63 Ready to merge");
	});

	it("syncs and clears pi UI widgets", () => {
		const setWidget = vi.fn();
		const setStatus = vi.fn();
		const ctx = { hasUI: true, ui: { setWidget, setStatus } } as unknown as ExtensionContext;
		syncTrackerUi(ctx, state);
		expect(setWidget).toHaveBeenCalledWith(EXTENSION_ID, renderWidgetLines(state));
		expect(setStatus).toHaveBeenCalledWith(EXTENSION_ID, "PR #63 Ready to merge");

		syncTrackerUi(ctx, {});
		expect(setWidget).toHaveBeenLastCalledWith(EXTENSION_ID, undefined);
		expect(setStatus).toHaveBeenLastCalledWith(EXTENSION_ID, undefined);
	});

	it("does nothing without UI", () => {
		const setWidget = vi.fn();
		syncTrackerUi({ hasUI: false, ui: { setWidget } } as unknown as ExtensionContext, state);
		expect(setWidget).not.toHaveBeenCalled();
	});
});
