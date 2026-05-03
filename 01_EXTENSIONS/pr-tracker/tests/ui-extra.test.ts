import { describe, expect, it } from "vitest";
import { formatChecks, formatNotification, formatPullRequestDetails, renderWidgetLines } from "../src/ui.ts";
import type { TrackerState } from "../src/types.ts";
import { trackedState } from "./helpers.ts";

describe("ui edge cases", () => {
	it("formats non-passing check states", () => {
		expect(formatChecks({ state: "none", total: 0, passed: 0, pending: 0, failed: 0 })).toBe("Checks —");
		expect(formatChecks({ state: "failing", total: 2, passed: 1, pending: 0, failed: 1 })).toBe("Checks ✗ 1/2");
		expect(formatChecks({ state: "pending", total: 2, passed: 1, pending: 1, failed: 0 })).toBe("Checks … 1/2");
		expect(formatChecks({ state: "unknown", total: 2, passed: 1, pending: 0, failed: 0 })).toBe("Checks ? 1/2");
	});

	it("renders empty, errored, and long-title states", () => {
		expect(renderWidgetLines({})).toBeUndefined();
		expect(formatNotification({})).toBe("No tracked PR");
		expect(formatNotification({ lastError: "boom" })).toBe("No tracked PR (boom)");
		const state: TrackerState = trackedState();
		if (!state.pr) throw new Error("missing test PR");
		state.pr.title = "x".repeat(100);
		state.lastError = "refresh failed because the network is offline";
		expect(renderWidgetLines(state)?.[0]).toContain("…");
		expect(renderWidgetLines(state)?.[2]).toContain("Last refresh failed");
		expect(formatNotification({ pr: { ...state.pr, url: undefined } })).not.toContain("github.com");
		expect(formatPullRequestDetails({ ...state.pr, additions: undefined, deletions: 4, headRefName: undefined })).toContain("+0/-4");
		expect(formatPullRequestDetails({ ...state.pr, additions: 3, deletions: undefined })).toContain("+3/-0");
		expect(formatPullRequestDetails({ ...state.pr, additions: undefined, deletions: undefined, changedFiles: undefined })).not.toContain("+0/-0");
	});
});
