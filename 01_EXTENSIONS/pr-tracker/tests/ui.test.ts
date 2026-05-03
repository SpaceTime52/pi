import { describe, expect, it, vi } from "vitest";
import { EXTENSION_ID, type TrackerContext, type TrackerState } from "../src/types.ts";
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

function createContext(hasUI: boolean): TrackerContext {
	return {
		cwd: "/repo",
		hasUI,
		ui: { notify: vi.fn(), setWidget: vi.fn(), setStatus: vi.fn(), select: vi.fn(), confirm: vi.fn() },
		sessionManager: { getBranch: () => [] },
	};
}

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
		const ctx = createContext(true);
		syncTrackerUi(ctx, state);
		expect(ctx.ui.setWidget).toHaveBeenCalledWith(EXTENSION_ID, renderWidgetLines(state));
		expect(ctx.ui.setStatus).toHaveBeenCalledWith(EXTENSION_ID, "PR #63 Ready to merge");
		syncTrackerUi(ctx, {});
		expect(ctx.ui.setWidget).toHaveBeenLastCalledWith(EXTENSION_ID, undefined);
		expect(ctx.ui.setStatus).toHaveBeenLastCalledWith(EXTENSION_ID, undefined);
	});

	it("does nothing without UI", () => {
		const ctx = createContext(false);
		syncTrackerUi(ctx, state);
		expect(ctx.ui.setWidget).not.toHaveBeenCalled();
	});
});
