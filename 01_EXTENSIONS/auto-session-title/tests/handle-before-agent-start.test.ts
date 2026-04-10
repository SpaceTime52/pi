import { beforeEach, describe, expect, it } from "vitest";
import { clearOverviewUi, findLatestOverview, getOverviewOverlayOptions, restoreOverview } from "../src/handlers.js";
import { stubContext, stubRuntime } from "./helpers.js";

describe("overview restoration core", () => {
	beforeEach(() => clearOverviewUi(new Set(), stubContext()));

	it("returns undefined for malformed persisted overviews", () => {
		expect(findLatestOverview([
			{ type: "custom", id: "bad1", customType: "auto-session-title.overview", data: null },
			{ type: "custom", id: "bad2", customType: "auto-session-title.overview", data: { title: 123, summary: ["Goal: x"] } },
			{ type: "custom", id: "bad3", customType: "auto-session-title.overview", data: { title: "제목", summary: ["   ", null] } },
			{ type: "custom", id: "bad4", customType: "auto-session-title.overview", data: { title: "제목", summary: "bad" } },
		])).toBeUndefined();
	});

	it("finds the latest valid persisted overview entry", () => {
		expect(findLatestOverview([
			{ type: "custom", id: "1", customType: "other", data: { title: "x", summary: ["y"] } },
			{ type: "custom", id: "2", customType: "auto-session-title.overview", data: "invalid" },
			{ type: "custom", id: "5", customType: "auto-session-title.overview", data: { title: "현재 세션", summary: ["- Goal: 요약", "- Done: 오버레이 표시", `- ${"x".repeat(140)}`] } },
		])).toEqual({ entryId: "5", title: "현재 세션", summary: ["Goal: 요약", "Done: 오버레이 표시", `${"x".repeat(119)}…`] });
	});

	it("restores overlay, session name, and terminal title from persisted overview", () => {
		const runtime = stubRuntime("이전 이름");
		const ctx = stubContext([{ type: "custom", id: "3", customType: "auto-session-title.overview", data: { title: "현재 세션", summary: ["Goal: 요약", "Done: 오버레이 표시"] } }]);
		restoreOverview(runtime, ctx);
		expect(runtime.setSessionName).toHaveBeenCalledWith("현재 세션");
		expect(ctx.overlay.options?.overlayOptions).toEqual(expect.objectContaining({ anchor: "top-right", nonCapturing: true, width: getOverviewOverlayOptions().width }));
		expect(ctx.overlay.component?.render(36).join("\n")).toContain("제목: 현재 세션");
		expect(ctx.ui.setTitle).toHaveBeenCalledWith("π - 현재 세션");
	});

	it("reuses the same overlay for subsequent restores in the same session", () => {
		const ctx = stubContext([{ type: "custom", id: "1", customType: "auto-session-title.overview", data: { title: "첫 제목", summary: ["Goal: A"] } }]);
		restoreOverview(stubRuntime(), ctx);
		const firstRender = ctx.overlay.component?.render(36);
		expect(ctx.overlay.component?.render(40)).not.toBe(firstRender);
		ctx.sessionManager.getBranch.mockReturnValue([{ type: "custom", id: "2", customType: "auto-session-title.overview", data: { title: "둘째 제목", summary: ["Goal: B"] } }]);
		restoreOverview(stubRuntime(), ctx);
		expect(ctx.ui.custom).toHaveBeenCalledTimes(1);
		expect(ctx.overlay.tui.requestRender).toHaveBeenCalled();
	});
});
