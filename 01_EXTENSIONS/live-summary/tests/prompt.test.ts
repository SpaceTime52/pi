import { describe, expect, it } from "vitest";
import { buildSummaryPrompt, SUMMARY_SYSTEM_PROMPT } from "../src/prompt.ts";

describe("summary prompt", () => {
	it("system prompt is a single-line label policy", () => {
		expect(SUMMARY_SYSTEM_PROMPT).toMatch(/single line/i);
	});

	it("user prompt embeds the activity inside <activity> tags", () => {
		const out = buildSummaryPrompt("doing things");
		expect(out).toContain("<activity>");
		expect(out).toContain("doing things");
		expect(out).toContain("</activity>");
		expect(out).toContain("10~18자");
	});
});
