import { describe, expect, it } from "vitest";
import { buildOverviewBodyLines, buildOverviewWidgetText, getOverviewOverlayOptions } from "../src/handlers.js";

describe("buildOverviewWidgetText", () => {
	it("renders overview bullets when an overview exists", () => {
		expect(
			buildOverviewWidgetText({ title: "세션 제목", summary: ["Goal: A", "Done: B", "Note: C", "Next: D"] }),
		).toBe(["세션 요약", "제목: 세션 제목", "• Goal: A", "• Done: B", "• Note: C", "• Next: D"].join("\n"));
	});

	it("renders placeholder content with a fallback title", () => {
		expect(buildOverviewWidgetText(undefined, "임시 제목")).toContain("제목: 임시 제목");
		expect(buildOverviewWidgetText()).toContain("제목: 이름 없는 세션");
	});
});

describe("buildOverviewBodyLines", () => {
	it("returns compact body lines for the overlay panel", () => {
		expect(buildOverviewBodyLines({ title: "작업 제목", summary: ["Goal: A", "Done: B"] })).toEqual([
			"제목: 작업 제목",
			"• Goal: A",
			"• Done: B",
		]);
	});
});

describe("getOverviewOverlayOptions", () => {
	it("uses a non-capturing top-right overlay", () => {
		const options = getOverviewOverlayOptions();
		expect(options.anchor).toBe("top-right");
		expect(options.width).toBe(36);
		expect(options.nonCapturing).toBe(true);
		expect(options.visible?.(120, 40)).toBe(true);
		expect(options.visible?.(90, 40)).toBe(false);
	});
});
