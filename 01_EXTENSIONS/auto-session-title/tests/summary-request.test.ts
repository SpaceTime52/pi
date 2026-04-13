import { describe, expect, it } from "vitest";
import { ensureOverviewRequestLine } from "../src/summary-request.js";

describe("ensureOverviewRequestLine", () => {
	it("returns the overview unchanged when summary is blank or no user request is available", () => {
		const empty = { title: "세션 제목", summary: [] };
		expect(ensureOverviewRequestLine(empty, "User: footer 요약 고쳐줘")).toBe(empty);
		const overview = { title: "세션 제목", summary: ["끝난 일", "다음 단계"] };
		expect(ensureOverviewRequestLine(overview, "Assistant: only tool chatter")).toBe(overview);
	});

	it("keeps an existing english request line without duplicating it", () => {
		const overview = { title: "Branch diff", summary: ["Request: compare the two branches", "Found one changed file"] };
		expect(ensureOverviewRequestLine(overview, "User: compare the two branches")).toBe(overview);
	});
});
