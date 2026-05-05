import { describe, expect, it } from "vitest";
import { extractActivityText, MAX_ACTIVITY_CHARS, MAX_SUMMARY_CHARS, trimSummary } from "../src/activity.ts";

describe("extractActivityText", () => {
	it("returns empty string for empty branch", () => {
		expect(extractActivityText([])).toBe("");
	});

	it("skips entries without a recognized message role and string content fast-path", () => {
		const branch = [
			{ type: "custom" },
			{ type: "message", message: undefined },
			{ type: "message", message: { role: "system", content: "ignored" } },
			{ type: "message", message: { role: "user", content: "hi there" } },
			{ type: "message", message: { role: "assistant", content: 123 as unknown as string } },
		];
		expect(extractActivityText(branch as never)).toBe("user: hi there");
	});

	it("extracts text and toolCall blocks from array content", () => {
		const branch = [
			{
				type: "message",
				message: {
					role: "assistant",
					content: [
						null,
						{ type: "text", text: "writing tests" },
						{ type: "toolCall", name: "bash", arguments: { command: "ls" } },
						{ type: "toolCall", name: "noop" }, // arguments missing -> ?? {} branch
						{ type: "toolCall" }, // unnamed -> skipped
						{ type: "image" }, // unrelated -> skipped
					],
				},
			},
			{
				type: "message",
				message: { role: "toolResult", content: [{ type: "text", text: "exit 0" }] },
			},
		];
		const out = extractActivityText(branch as never);
		expect(out).toContain("assistant: writing tests");
		expect(out).toContain('assistant tool=bash args={"command":"ls"}');
		expect(out).toContain("assistant tool=noop args={}");
		expect(out).toContain("toolResult: exit 0");
	});

	it("truncates very long activity to last MAX_ACTIVITY_CHARS chars", () => {
		// Per-block content is capped at 600 chars, so we need many blocks to
		// exceed MAX_ACTIVITY_CHARS and exercise the tail-slice path.
		const big = "x".repeat(600);
		const branch = Array.from({ length: 6 }, () => ({
			type: "message",
			message: { role: "assistant", content: [{ type: "text", text: big }] },
		}));
		const out = extractActivityText(branch as never);
		expect(out.length).toBeLessThanOrEqual(MAX_ACTIVITY_CHARS);
		expect(out.endsWith("x")).toBe(true);
	});
});

describe("trimSummary", () => {
	it("strips quotes, trailing punctuation, and extra lines", () => {
		expect(trimSummary('"🔧 PR 트래커 작성".\n추가설명')).toBe("🔧 PR 트래커 작성");
	});

	it("respects MAX_SUMMARY_CHARS code-point boundary", () => {
		const long = "🔧" + "가".repeat(50);
		expect(Array.from(trimSummary(long)).length).toBe(MAX_SUMMARY_CHARS);
	});

	it("returns empty for empty input", () => {
		expect(trimSummary("")).toBe("");
		expect(trimSummary("   ")).toBe("");
	});

	it("keeps single-line input intact (no newline branch)", () => {
		expect(trimSummary("🔧 작성")).toBe("🔧 작성");
	});
});
