import { beforeEach, describe, expect, it } from "vitest";
import { ENTRY_TYPE } from "../src/constants.js";
import { buildEntry, isEnabled, resetState, restoreFromEntries, setEnabled } from "../src/state.js";

describe("state", () => {
	beforeEach(() => {
		resetState();
	});

	it("starts enabled and reports changes", () => {
		expect(isEnabled()).toBe(true);
		expect(setEnabled(false)).toBe(true);
		expect(isEnabled()).toBe(false);
		expect(setEnabled(false)).toBe(false);
	});

	it("builds persisted entry with explicit timestamp", () => {
		setEnabled(false);
		expect(buildEntry(1234)).toEqual({ enabled: false, updatedAt: 1234 });
	});

	it("restores newest valid custom entry", () => {
		const restored = restoreFromEntries([
			{ type: "custom", customType: ENTRY_TYPE, data: { enabled: true } },
			{ type: "custom", customType: ENTRY_TYPE, data: { enabled: false } },
		]);
		expect(restored).toBe(false);
		expect(isEnabled()).toBe(false);
	});

	it("ignores malformed entries and falls back to enabled", () => {
		setEnabled(false);
		const restored = restoreFromEntries([
			{ type: "custom", customType: ENTRY_TYPE, data: { enabled: "nope" } },
			{ type: "assistant", customType: ENTRY_TYPE, data: { enabled: true } },
			{ type: "custom", customType: "other", data: { enabled: false } },
			{ type: "custom", customType: ENTRY_TYPE, data: null },
		]);
		expect(restored).toBe(true);
		expect(isEnabled()).toBe(true);
	});
});
