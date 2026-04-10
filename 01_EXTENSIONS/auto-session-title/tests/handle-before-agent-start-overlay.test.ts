import { beforeEach, describe, expect, it } from "vitest";
import { clearOverviewUi, restoreOverview } from "../src/handlers.js";
import { attachOverlay, stubContext, stubRuntime } from "./helpers.js";

describe("overview restoration overlay lifecycle", () => {
	beforeEach(() => clearOverviewUi(new Set(), stubContext()));

	it("replaces the old overlay when the session id changes", () => {
		const firstCtx = stubContext([{ type: "custom", id: "1", customType: "auto-session-title.overview", data: { title: "첫 세션", summary: ["현재 상태를 짧게 표시함"] } }]);
		restoreOverview(stubRuntime(), firstCtx);
		const secondCtx = stubContext([{ type: "custom", id: "2", customType: "auto-session-title.overview", data: { title: "둘째 세션", summary: ["다음 상태로 전환함"] } }], { sessionManager: { ...stubContext().sessionManager, getSessionId: () => "session-2" } });
		restoreOverview(stubRuntime(), secondCtx);
		expect(firstCtx.overlay.handle.hide).toHaveBeenCalled();
		expect(secondCtx.ui.custom).toHaveBeenCalledTimes(1);
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
