import { describe, expect, it } from "vitest";
import { ensureOverviewRequestLine } from "../src/summary-request.js";

describe("ensureOverviewRequestLine", () => {
	it("returns overview unchanged when summary is blank or no user request is available", () => {
		const empty = { title: "세션 제목", summary: [] };
		expect(ensureOverviewRequestLine(empty, "User: footer 요약 고쳐줘")).toBe(empty);
		const overview = { title: "세션 제목", summary: ["끝난 일", "다음 단계"] };
		expect(ensureOverviewRequestLine(overview, "Assistant: only tool chatter")).toBe(overview);
		expect(ensureOverviewRequestLine(overview, "User: ```")).toBe(overview);
	});

	it("prepends compact english request line when summary does not already show it", () => {
		const overview = { title: "Branch diff", summary: ["```", "Found one changed file"] };
		expect(ensureOverviewRequestLine(overview, "User: compare the two branches")).toEqual({ title: "Branch diff", summary: ["Request: compare the two branches", "```", "Found one changed file"] });
	});

	it("treats intent-only paraphrases as existing request context", () => {
		const overview = { title: "Branch diff", summary: ["Needs to compare the two branches quickly", "Found one changed file"] };
		expect(ensureOverviewRequestLine(overview, "User: compare the two branches")).toBe(overview);
	});

	it("returns same overview when request is already captured once", () => {
		const overview = { title: "Branch diff", summary: ["Request: compare the two branches", "Found one changed file"] };
		expect(ensureOverviewRequestLine(overview, "User: compare the two branches")).toBe(overview);
	});

	it("keeps one request line when summary repeats request multiple ways", () => {
		const overview = { title: "Branch diff", summary: ["Request: compare the two branches", "Found one changed file", "The user wants to compare the two branches quickly"] };
		expect(ensureOverviewRequestLine(overview, "User: compare the two branches")).toEqual({ title: "Branch diff", summary: ["Request: compare the two branches", "Found one changed file"] });
	});

	it("drops request-restatement bullets when title already names the task", () => {
		const overview = {
			title: "말록스 콘트라 가격 확인",
			summary: [
				"요청: 구글에서 말록스 콘트라 가격 찾아봐",
				"사용자는 구글 기준으로 말록스 콘트라 가격을 빠르게 확인하려고 한다.",
				"확인된 신품 시세는 대체로 고가다.",
				"국내 중고 상세 가격 확인은 403으로 막혔다.",
			],
		};
		expect(ensureOverviewRequestLine(overview, "User: 구글에서 말록스 콘트라 가격 찾아봐")).toEqual({ title: "말록스 콘트라 가격 확인", summary: ["확인된 신품 시세는 대체로 고가다.", "국내 중고 상세 가격 확인은 403으로 막혔다."] });
	});
});
