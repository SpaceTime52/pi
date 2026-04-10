import { beforeEach, describe, expect, it } from "vitest";
import { clearOverviewUi, restoreOverview } from "../src/handlers.js";
import { stubContext, stubRuntime } from "./helpers.js";

describe("overview restoration fallbacks", () => {
	beforeEach(() => clearOverviewUi(new Set(), stubContext()));

	it("falls back to runtime or session title when no overview exists", () => {
		const runtime = stubRuntime("런타임 제목");
		const ctx = stubContext([], { sessionManager: { ...stubContext().sessionManager, getSessionName: () => "세션 제목" } });
		restoreOverview(runtime, ctx);
		expect(runtime.setSessionName).not.toHaveBeenCalled();
		expect(ctx.overlay.component?.render(48).join("\n")).toContain("런타임 제목");
		expect(ctx.ui.setTitle).toHaveBeenCalledWith("π - 런타임 제목");
	});

	it("opens a placeholder overlay when UI exists and skips title updates without a name", () => {
		const ctx = stubContext();
		restoreOverview(stubRuntime(), ctx);
		expect(ctx.ui.custom).toHaveBeenCalled();
		expect(ctx.overlay.component?.render(60).join("\n")).toContain("다음 응답이 끝나면 자동으로 정리됩니다.");
		expect(ctx.overlay.component?.render(60).join("\n")).toContain("세션 요약");
		expect(ctx.ui.setTitle).not.toHaveBeenCalled();
	});

	it("skips overlay and title updates when UI is unavailable", () => {
		const ctx = stubContext([], { hasUI: false });
		restoreOverview(stubRuntime(), ctx);
		expect(ctx.ui.custom).not.toHaveBeenCalled();
		expect(ctx.ui.setTitle).not.toHaveBeenCalled();
	});
});
