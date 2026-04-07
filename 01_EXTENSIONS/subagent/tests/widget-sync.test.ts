import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
	syncWidget, resetWidgetState, startWidgetTimer, stopWidgetTimer,
} from "../src/widget.js";

beforeEach(() => resetWidgetState());
afterEach(() => stopWidgetTimer());

describe("syncWidget", () => {
	it("sets widget when runs exist", () => {
		const setWidget = vi.fn();
		const ctx = { hasUI: true, ui: { setWidget } };
		syncWidget(ctx, [{ id: 1, agent: "scout", startedAt: Date.now() }]);
		expect(setWidget).toHaveBeenCalledWith("subagent-status", expect.any(Array), { placement: "belowEditor" });
	});
	it("clears widget when no runs", () => {
		const setWidget = vi.fn();
		syncWidget({ hasUI: true, ui: { setWidget } }, []);
		expect(setWidget).toHaveBeenCalledWith("subagent-status", undefined);
	});
	it("skips when no UI", () => {
		const setWidget = vi.fn();
		syncWidget({ hasUI: false, ui: { setWidget } }, [{ id: 1, agent: "w", startedAt: 0 }]);
		expect(setWidget).not.toHaveBeenCalled();
	});
});

describe("startWidgetTimer / stopWidgetTimer", () => {
	it("calls syncWidget on interval", async () => {
		const setWidget = vi.fn();
		const ctx = { hasUI: true, ui: { setWidget } };
		startWidgetTimer(ctx, () => [{ id: 1, agent: "a", startedAt: Date.now() }]);
		await new Promise((r) => setTimeout(r, 200));
		stopWidgetTimer();
		expect(setWidget.mock.calls.length).toBeGreaterThan(0);
	});
	it("stopWidgetTimer stops the interval", async () => {
		const setWidget = vi.fn();
		const ctx = { hasUI: true, ui: { setWidget } };
		startWidgetTimer(ctx, () => [{ id: 1, agent: "a", startedAt: Date.now() }]);
		stopWidgetTimer();
		const before = setWidget.mock.calls.length;
		await new Promise((r) => setTimeout(r, 200));
		expect(setWidget.mock.calls.length).toBe(before);
	});
	it("startWidgetTimer replaces existing timer", () => {
		const ctx = { hasUI: true, ui: { setWidget: vi.fn() } };
		startWidgetTimer(ctx, () => []);
		startWidgetTimer(ctx, () => []);
		stopWidgetTimer();
	});
	it("stopWidgetTimer is safe to call without a timer", () => {
		expect(() => stopWidgetTimer()).not.toThrow();
	});
});
