import { describe, expect, it } from "vitest";
import { createTrackedState, isTrackerEntryData, reconstructState } from "../src/state.ts";
import { EXTENSION_ID } from "../src/types.ts";
import { trackedState } from "./helpers.ts";

describe("state edge cases", () => {
	it("rejects invalid tracker entries while reconstructing", () => {
		expect(isTrackerEntryData(undefined)).toBe(false);
		expect(isTrackerEntryData({ version: 1, kind: "state", state: null })).toBe(false);
		expect(reconstructState([undefined, { type: "custom", customType: EXTENSION_ID, data: { version: 0 } }])).toEqual({});
	});

	it("uses fallback tracked refs and timestamps", () => {
		const status = trackedState().pr;
		if (!status) throw new Error("missing test PR");
		expect(createTrackedState({ ...status, url: undefined }, { trackedRef: "old" }, { now: () => "now" })).toMatchObject({ trackedRef: "old", trackedAt: "now" });
		expect(createTrackedState({ ...status, url: undefined }, {}, { now: () => "now" })).toMatchObject({ trackedRef: "63", trackedAt: "now" });
	});
});
