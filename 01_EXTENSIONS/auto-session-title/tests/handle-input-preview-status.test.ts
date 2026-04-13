import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearOverviewUi, previewOverviewFromInput } from "../src/handlers.js";
import { stubContext } from "./helpers.js";

describe("previewOverviewFromInput footer status", () => {
	beforeEach(() => clearOverviewUi(new Set(), stubContext()));

	it("writes preview to footer statuses and clears them on teardown when status sink exists", () => {
		const base = stubContext();
		const setStatus = vi.fn();
		const ctx = { ...base, ui: { ...base.ui, setStatus } };
		expect(previewOverviewFromInput(ctx, "README.md에 설명 추가해줘")).toBe(true);
		expect(ctx.ui.custom).not.toHaveBeenCalled();
		expect(ctx.ui.setWidget).not.toHaveBeenCalled();
		expect(setStatus).toHaveBeenCalledWith("auto-session-title.overview.title", "README.md에 설명 추가");
		expect(setStatus).toHaveBeenCalledWith("auto-session-title.overview.summary.0", "현재 README.md에 설명 추가 요청 처리 중이다.");
		clearOverviewUi(new Set(), ctx);
		expect(setStatus).toHaveBeenCalledWith("auto-session-title.overview.title", undefined);
		expect(setStatus).toHaveBeenCalledWith("auto-session-title.overview.summary.0", undefined);
	});
});
