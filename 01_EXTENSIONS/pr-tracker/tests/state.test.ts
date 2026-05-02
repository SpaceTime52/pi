import { describe, expect, it } from "vitest";
import { createErrorState, createTrackedState, reconstructState, serializeState } from "../src/state.ts";
import { EXTENSION_ID, type PullRequestStatus } from "../src/types.ts";

const pr: PullRequestStatus = {
	number: 63,
	checks: { state: "passing", total: 1, passed: 1, pending: 0, failed: 0 },
	review: { state: "approved", label: "Review approved" },
	readiness: { state: "ready", label: "Ready to merge" },
	updatedAt: "updated",
	url: "https://github.com/acme/web/pull/63",
};

describe("state", () => {
	it("serializes and reconstructs the latest tracker state on the branch", () => {
		const first = { pr, trackedRef: "63", trackedAt: "t1" };
		const second = { ...first, lastError: "boom" };
		const entries = [
			{ type: "custom", customType: EXTENSION_ID, data: serializeState(first) },
			{ type: "custom", customType: "other", data: serializeState({}) },
			{ type: "custom", customType: EXTENSION_ID, data: serializeState(second) },
		];
		expect(reconstructState(entries)).toEqual(second);
	});

	it("creates tracked state without resetting the original trackedAt", () => {
		const state = createTrackedState(pr, { trackedAt: "old" }, { ref: "63", source: "manual", now: () => "new" });
		expect(state).toMatchObject({ trackedAt: "old", trackedRef: pr.url, source: "manual", lastError: undefined });
	});

	it("records refresh errors", () => {
		expect(createErrorState({ trackedRef: "63" }, "failed", () => "now")).toEqual({
			trackedRef: "63",
			lastError: "failed",
			updatedAt: "now",
		});
	});
});
