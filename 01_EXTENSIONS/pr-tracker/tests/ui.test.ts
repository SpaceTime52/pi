import { describe, expect, it, vi } from "vitest";
import { EXTENSION_ID, type TrackerContext, type TrackerState } from "../src/types.ts";
import {
	formatNotification,
	formatPullRequestNumber,
	formatStatus,
	hyperlink,
	renderWidgetLines,
	sanitizeHyperlinkUrl,
	syncTrackerUi,
} from "../src/ui.ts";

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
	const linkedNumber = "\u001B]8;;https://github.com/acme/web/pull/63\u0007#63\u001B]8;;\u0007";

	it("formats PR number hyperlinks", () => {
		expect(sanitizeHyperlinkUrl("https://github.com/acme/web/pull/63\u0007\u001B\u007F")).toBe(
			"https://github.com/acme/web/pull/63",
		);
		expect(hyperlink("#63", "https://github.com/acme/web/pull/63")).toBe(linkedNumber);
		expect(formatPullRequestNumber(state.pr)).toBe(linkedNumber);
		expect(formatPullRequestNumber({ number: 64, url: undefined })).toBe("#64");
	});

	it("renders compact PR widget lines", () => {
		expect(renderWidgetLines(state)).toEqual([
			`${linkedNumber} Ready to merge · Add PR tracker`,
			"  https://github.com/acme/web/pull/63",
			"  Checks ✓ 3/3 · Review approved · Changes 1 · +10/-2 · feature/pr-tracker → main",
			"  /pr refresh · /pr open · /pr merge · /pr untrack",
		]);
		expect(formatStatus(state)).toBe(`PR ${linkedNumber} Ready to merge`);
		expect(formatNotification(state)).toContain(`${linkedNumber} Ready to merge`);
	});

	it("syncs and clears pi UI widgets", () => {
		const ctx = createContext(true);
		syncTrackerUi(ctx, state);
		expect(ctx.ui.setWidget).toHaveBeenCalledWith(EXTENSION_ID, renderWidgetLines(state));
		expect(ctx.ui.setStatus).toHaveBeenCalledWith(EXTENSION_ID, `PR ${linkedNumber} Ready to merge`);
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
