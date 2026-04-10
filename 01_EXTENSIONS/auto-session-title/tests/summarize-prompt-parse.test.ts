import { describe, expect, it } from "vitest";
import { buildOverviewPrompt, parseOverviewResponse } from "../src/summarize.js";

describe("buildOverviewPrompt", () => {
	it("includes previous overview when available", () => {
		const prompt = buildOverviewPrompt("Recent updates", { title: "기존 제목", summary: ["Goal: A", "Done: B"] });
		expect(prompt).toContain("Previous title: 기존 제목");
		expect(prompt).toContain("- Goal: A");
	});
	it("falls back when no previous overview exists", () => {
		expect(buildOverviewPrompt("Recent updates")).toContain("Previous summary: (none)");
	});
});

describe("parseOverviewResponse", () => {
	it("parses structured overview responses", () => {
		expect(parseOverviewResponse(["TITLE: 세션 제목", "SUMMARY:", "- Goal: 요약 위젯 만들기", "- Done: UI 위치 결정", "- Note: footer 대신 상시 위젯", "- Next: 제목 동기화"].join("\n"))).toEqual({ title: "세션 제목", summary: ["Goal: 요약 위젯 만들기", "Done: UI 위치 결정", "Note: footer 대신 상시 위젯", "Next: 제목 동기화"] });
	});
	it("supports inline SUMMARY and truncates long lines", () => {
		const parsed = parseOverviewResponse(`TITLE: 긴 제목\nSUMMARY: ${"x".repeat(300)}`);
		expect(parsed?.summary).toHaveLength(1);
		expect(parsed?.summary[0]?.endsWith("…")).toBe(true);
	});
	it("returns undefined when title or summary is missing", () => {
		expect(parseOverviewResponse("SUMMARY:\n- only summary")).toBeUndefined();
		expect(parseOverviewResponse("TITLE: 제목만")).toBeUndefined();
		expect(parseOverviewResponse("TITLE: 제목\nnoise without bullets")).toEqual({ title: "제목", summary: ["noise without bullets"] });
	});
});
