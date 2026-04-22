import { describe, expect, it } from "vitest";
import { buildFallbackTitle } from "../src/fallback-title.ts";

describe("fallback title", () => {
	it("summarizes session and terminal title requests instead of exposing the raw prompt", () => {
		expect(buildFallbackTitle("https://example.com 이거 참고해서 세션 이름? 터미널 제목? 만들어서 설정해주는거 작업해줘. 이름은 좀 더 명료하게 해. extensions에 만들면 됨. 다 만들고 커밋 푸시도 해")).toBe("세션/터미널 제목 자동 설정");
		expect(buildFallbackTitle("Please add session title and terminal title extension.")).toBe("session/terminal title auto sync extension");
		expect(buildFallbackTitle("세션 이름 자동으로 설정해줘")).toBe("세션 제목 자동 설정");
		expect(buildFallbackTitle("세션 제목 extension 만들어줘")).toBe("세션 제목 자동 설정 extension");
		expect(buildFallbackTitle("Please add a session title extension.")).toBe("session title auto naming extension");
		expect(buildFallbackTitle("[docs](https://example.com) Please add a terminal title sync.")).toBe("terminal title sync");
		expect(buildFallbackTitle("터미널 제목 extension 만들어줘")).toBe("터미널 제목 자동 설정 extension");
	});

	it("handles empty and short prompts", () => {
		expect(buildFallbackTitle("   ")).toBe("");
		expect(buildFallbackTitle("go")).toBe("go");
	});
});
