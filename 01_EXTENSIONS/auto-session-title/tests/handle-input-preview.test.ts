import { beforeEach, describe, expect, it } from "vitest";
import { clearOverviewUi, previewOverviewFromInput, restoreOverview } from "../src/handlers.js";
import { stubContext, stubRuntime } from "./helpers.js";

describe("previewOverviewFromInput", () => {
	beforeEach(() => clearOverviewUi(new Set(), stubContext()));

	it("seeds the overlay and titles from the first real user message", () => {
		const ctx = stubContext();
		expect(previewOverviewFromInput(ctx, "요약 영역을 창 크기에 맞춰 더 넓고 반응형으로 보여줘")).toBe(true);
		expect(ctx.overlay.component?.render(80).join("\n")).toContain("요약 영역을 창 크기에 맞춰 더 넓고 반응형으로 보여줘");
		expect(ctx.ui.setTitle).toHaveBeenCalledWith("π - 요약 영역을 창 크기에 맞춰 더 넓고 반응형으로 보여줘");
	});

	it("ignores empty commands, greetings, and already-persisted overviews", () => {
		expect(previewOverviewFromInput(stubContext(), "/help")).toBe(false);
		expect(previewOverviewFromInput(stubContext(), "안녕")).toBe(false);
		expect(previewOverviewFromInput(stubContext(), "!!!")).toBe(false);
		expect(previewOverviewFromInput(stubContext(), "\"\"")).toBe(false);
		expect(previewOverviewFromInput(stubContext(), "```ts\nconst x = 1;\n```")).toBe(false);
		expect(previewOverviewFromInput(stubContext([{ type: "custom", id: "ov1", customType: "auto-session-title.overview", data: { title: "기존 제목", summary: ["기존 요약"] } }]), "다른 요청")).toBe(false);
	});

	it("does not leak a preview into another tree view with no persisted overview", () => {
		const first = stubContext();
		previewOverviewFromInput(first, "브랜치 A 미리보기");
		const second = stubContext([], { sessionManager: { ...stubContext().sessionManager, getSessionId: () => "session-1", getSessionName: () => undefined } });
		restoreOverview(stubRuntime(), second);
		const rendered = first.overlay.component?.render(80).join("\n") ?? "";
		expect(rendered).toContain("세션 요약");
		expect(rendered).not.toContain("브랜치 A 미리보기");
	});
});
