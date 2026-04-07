import { expect, it, vi } from "vitest";
import { resetWidgetState, startWidgetTimer } from "../src/widget.js";

it("resetWidgetState stops any running timer", () => {
	const ctx = { hasUI: true, ui: { setWidget: vi.fn() } };
	startWidgetTimer(ctx, () => []);
	resetWidgetState();
	const calls = (ctx.ui.setWidget as ReturnType<typeof vi.fn>).mock.calls.length;
	vi.useFakeTimers();
	vi.advanceTimersByTime(500);
	vi.useRealTimers();
	expect((ctx.ui.setWidget as ReturnType<typeof vi.fn>).mock.calls.length).toBe(calls);
});
