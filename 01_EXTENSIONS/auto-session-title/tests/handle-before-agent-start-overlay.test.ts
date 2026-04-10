import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearOverviewUi, restoreOverview } from "../src/handlers.js";
import { attachOverlay, stubContext, stubRuntime } from "./helpers.js";
const originalColumns = process.stdout.columns;
const originalRows = process.stdout.rows;
const originalOn = process.stdout.on;
const originalOff = process.stdout.off;
function setTerminalSize(columns: number, rows: number = originalRows ?? 40): void {
	Object.defineProperty(process.stdout, "columns", { configurable: true, value: columns });
	Object.defineProperty(process.stdout, "rows", { configurable: true, value: rows });
}

describe("overview restoration overlay lifecycle", () => {
	beforeEach(() => {
		setTerminalSize(128);
		clearOverviewUi(new Set(), stubContext());
	});
	afterEach(() => {
		Object.defineProperty(process.stdout, "columns", { configurable: true, value: originalColumns });
		Object.defineProperty(process.stdout, "rows", { configurable: true, value: originalRows });
		Object.defineProperty(process.stdout, "on", { configurable: true, value: originalOn });
		Object.defineProperty(process.stdout, "off", { configurable: true, value: originalOff });
	});
	it("replaces the old overlay when the session id changes", () => {
		const firstCtx = stubContext([{ type: "custom", id: "1", customType: "auto-session-title.overview", data: { title: "첫 세션", summary: ["현재 상태를 짧게 표시함"] } }]);
		restoreOverview(stubRuntime(), firstCtx);
		const secondCtx = stubContext([{ type: "custom", id: "2", customType: "auto-session-title.overview", data: { title: "둘째 세션", summary: ["다음 상태로 전환함"] } }], { sessionManager: { ...stubContext().sessionManager, getSessionId: () => "session-2" } });
		restoreOverview(stubRuntime(), secondCtx);
		expect(firstCtx.overlay.handle.hide).toHaveBeenCalled();
		expect(secondCtx.ui.custom).toHaveBeenCalledTimes(1);
	});
	it("recreates the overlay when terminal width changes so right anchoring stays stable", () => {
		const ctx = stubContext([{ type: "custom", id: "1", customType: "auto-session-title.overview", data: { title: "현재 세션", summary: ["현재 상태를 짧게 표시함"] } }]);
		restoreOverview(stubRuntime(), ctx);
		const firstOptions = ctx.overlay.options?.overlayOptions;
		setTerminalSize(140);
		process.stdout.emit("resize");
		expect(ctx.overlay.handle.hide).toHaveBeenCalled();
		expect(ctx.ui.custom).toHaveBeenCalledTimes(2);
		expect(firstOptions).not.toEqual(ctx.overlay.options?.overlayOptions);
	});
	it("ignores resize notifications when the layout key did not change or the overlay is already gone", () => {
		const onSpy = vi.spyOn(process.stdout, "on");
		const offSpy = vi.spyOn(process.stdout, "off");
		const ctx = stubContext([{ type: "custom", id: "1", customType: "auto-session-title.overview", data: { title: "현재 세션", summary: ["현재 상태를 짧게 표시함"] } }]);
		restoreOverview(stubRuntime(), ctx);
		process.stdout.emit("resize");
		expect(ctx.ui.custom).toHaveBeenCalledTimes(1);
		const resizeListener = onSpy.mock.calls.find(([eventName]) => eventName === "resize")?.[1] as (() => void) | undefined;
		clearOverviewUi(new Set(), ctx);
		resizeListener?.();
		expect(offSpy).toHaveBeenCalledWith("resize", expect.any(Function));
		onSpy.mockRestore();
		offSpy.mockRestore();
	});
	it("skips resize subscription when stdout resize hooks are unavailable", () => {
		Object.defineProperty(process.stdout, "on", { configurable: true, value: undefined });
		Object.defineProperty(process.stdout, "off", { configurable: true, value: undefined });
		const ctx = stubContext([{ type: "custom", id: "1", customType: "auto-session-title.overview", data: { title: "현재 세션", summary: ["현재 상태를 짧게 표시함"] } }]);
		restoreOverview(stubRuntime(), ctx);
		expect(ctx.ui.custom).toHaveBeenCalledTimes(1);
	});
	it("clears pending overlay state when opening the overlay later rejects", async () => {
		const ctx = stubContext([{ type: "custom", id: "1", customType: "auto-session-title.overview", data: { title: "현재 세션", summary: ["현재 상태를 짧게 표시함"] } }]);
		ctx.ui.custom.mockImplementationOnce((factory, options) => attachOverlay(ctx.overlay, factory, options).then(() => { throw new Error("overlay failed"); }));
		restoreOverview(stubRuntime(), ctx);
		await Promise.resolve();
		await Promise.resolve();
		const nextCtx = stubContext([{ type: "custom", id: "2", customType: "auto-session-title.overview", data: { title: "다음 세션", summary: ["다음 상태로 전환함"] } }]);
		restoreOverview(stubRuntime(), nextCtx);
		expect(nextCtx.ui.custom).toHaveBeenCalledTimes(1);
	});
	it("ignores stale handle callbacks after the overlay is cleared", () => {
		const ctx = stubContext([{ type: "custom", id: "1", customType: "auto-session-title.overview", data: { title: "현재 세션", summary: ["현재 상태를 짧게 표시함"] } }]);
		ctx.ui.custom.mockImplementationOnce((factory, options) => {
			const promise = attachOverlay(ctx.overlay, factory, options);
			clearOverviewUi(new Set(), ctx);
			options?.onHandle?.(ctx.overlay.handle);
			return promise;
		});
		restoreOverview(stubRuntime(), ctx);
		const nextCtx = stubContext([{ type: "custom", id: "2", customType: "auto-session-title.overview", data: { title: "다음 세션", summary: ["다음 상태로 전환함"] } }]);
		restoreOverview(stubRuntime(), nextCtx);
		expect(nextCtx.ui.custom).toHaveBeenCalledTimes(1);
	});
	it("clears the overlay and all in-flight work on shutdown", () => {
		const ctx = stubContext([{ type: "custom", id: "1", customType: "auto-session-title.overview", data: { title: "현재 세션", summary: ["현재 상태를 짧게 표시함"] } }]);
		restoreOverview(stubRuntime(), ctx);
		const inFlight = new Set<string>(["session-1", "session-2"]);
		clearOverviewUi(inFlight, ctx);
		expect(inFlight.size).toBe(0);
		expect(ctx.overlay.handle.hide).toHaveBeenCalled();
	});
});
