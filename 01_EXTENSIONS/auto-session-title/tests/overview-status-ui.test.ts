import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearOverlayState, ensureOverviewOverlay } from "../src/overlay-state.js";
import { clearOverviewStatus, syncOverviewStatus } from "../src/overview-status.js";
import { clearOverviewDisplay, syncOverviewUi } from "../src/overview-ui.js";
import { stubContext } from "./helpers.js";

describe("overview status sync", () => {
	beforeEach(() => {
		clearOverviewStatus();
		clearOverlayState();
	});
	afterEach(() => {
		clearOverviewStatus();
		clearOverlayState();
	});

	it("returns false when footer status sink is unavailable", () => {
		expect(syncOverviewStatus(stubContext(), { title: "제목", summary: ["한 줄"] })).toBe(false);
		expect(syncOverviewStatus(stubContext([], { hasUI: false }), { title: "제목", summary: ["한 줄"] })).toBe(false);
	});

	it("can switch from multi-line overview to title-only footer state", () => {
		const base = stubContext();
		const setStatus = vi.fn();
		const ctx = { ...base, ui: { ...base.ui, setStatus } };
		expect(syncOverviewStatus(ctx, { title: "기존 제목", summary: ["첫 줄", "둘째 줄"] })).toBe(true);
		setStatus.mockClear();
		expect(syncOverviewStatus(ctx, undefined, "제목만 남김")).toBe(true);
		expect(setStatus).toHaveBeenCalledWith("auto-session-title.overview.title", "제목만 남김");
		expect(setStatus).toHaveBeenCalledWith("auto-session-title.overview.summary.0", undefined);
		expect(setStatus).toHaveBeenCalledWith("auto-session-title.overview.summary.1", undefined);
		clearOverviewStatus({ ...ctx, hasUI: false });
		setStatus.mockClear();
		expect(syncOverviewStatus(ctx, { title: "새 제목", summary: ["한 줄"] })).toBe(true);
		expect(setStatus).not.toHaveBeenCalledWith("auto-session-title.overview.summary.0", undefined);
	});

	it("clears stale global summary lines when two sessions share the same status sink", () => {
		const sharedSetStatus = vi.fn();
		const sessionA = { ...stubContext(), ui: { ...stubContext().ui, setStatus: sharedSetStatus } };
		const sessionBBase = stubContext([], {
			sessionManager: {
				getSessionId: vi.fn(() => "session-2"),
				getSessionName: vi.fn(() => undefined),
				getBranch: vi.fn(() => []),
			},
		});
		const sessionB = { ...sessionBBase, ui: { ...sessionBBase.ui, setStatus: sharedSetStatus } };

		expect(syncOverviewStatus(sessionA, { title: "세션 A", summary: ["A 첫 줄", "A 둘째 줄"] })).toBe(true);
		sharedSetStatus.mockClear();
		expect(syncOverviewStatus(sessionB, { title: "세션 B", summary: ["B 한 줄"] })).toBe(true);
		expect(sharedSetStatus).toHaveBeenCalledWith("auto-session-title.overview.title", "세션 B");
		expect(sharedSetStatus).toHaveBeenCalledWith("auto-session-title.overview.summary.0", "B 한 줄");
		expect(sharedSetStatus).toHaveBeenCalledWith("auto-session-title.overview.summary.1", undefined);
	});
});

describe("overview ui sync", () => {
	afterEach(() => clearOverviewDisplay());

	it("clears overlay state when overview disappears without footer status sink", () => {
		const ctx = stubContext();
		syncOverviewUi(ctx, { title: "제목", summary: ["한 줄"] }, "제목");
		expect(ctx.ui.custom).toHaveBeenCalled();
		syncOverviewUi(ctx);
		expect(ctx.overlay.handle.hide).toHaveBeenCalled();
	});

	it("skips overlay creation when UI is unavailable", () => {
		const ctx = stubContext([], { hasUI: false });
		ensureOverviewOverlay(ctx, { title: "제목", summary: ["한 줄"] }, "제목");
		expect(ctx.ui.custom).not.toHaveBeenCalled();
		expect(ctx.ui.setWidget).not.toHaveBeenCalled();
	});
});
