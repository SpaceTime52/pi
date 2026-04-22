import { describe, expect, it } from "vitest";
import { buildFallbackTitle } from "../src/fallback-title.ts";

describe("fallback title", () => {
	it("cleans urls and request framing", () => {
		expect(buildFallbackTitle("https://example.com 이거 참고해서 세션 이름 자동으로 설정해줘")).toBe("세션 이름 자동으로 설정");
		expect(buildFallbackTitle("[docs](https://example.com) Please add a terminal title sync.")).toBe("add a terminal title sync");
	});

	it("handles empty and short prompts", () => {
		expect(buildFallbackTitle("   ")).toBe("");
		expect(buildFallbackTitle("go")).toBe("go");
	});
});
