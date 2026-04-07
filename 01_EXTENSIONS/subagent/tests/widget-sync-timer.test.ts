import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetWidgetState, startWidgetTimer, stopWidgetTimer } from "../src/widget.js";

beforeEach(() => resetWidgetState());
afterEach(() => stopWidgetTimer());

describe("startWidgetTimer / stopWidgetTimer", () => {
	it("calls syncWidget on interval", async () => {
		const setWidget = vi.fn(), ctx = { hasUI: true, ui: { setWidget } };
		startWidgetTimer(ctx, () => [{ id: 1, agent: "a", startedAt: Date.now() }]);
		await new Promise((r) => setTimeout(r, 200));
		stopWidgetTimer();
		expect(setWidget.mock.calls.length).toBeGreaterThan(0);
	});

	it("stops and safely replaces timers", async () => {
		const setWidget = vi.fn(), ctx = { hasUI: true, ui: { setWidget } };
		startWidgetTimer(ctx, () => [{ id: 1, agent: "a", startedAt: Date.now() }]);
		stopWidgetTimer();
		const before = setWidget.mock.calls.length;
		await new Promise((r) => setTimeout(r, 200));
		expect(setWidget.mock.calls.length).toBe(before);
		startWidgetTimer(ctx, () => []);
		startWidgetTimer(ctx, () => []);
		stopWidgetTimer();
		expect(() => stopWidgetTimer()).not.toThrow();
	});
});
