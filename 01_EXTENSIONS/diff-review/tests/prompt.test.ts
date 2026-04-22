import { describe, expect, it } from "vitest";
import { composeReviewPrompt, hasReviewFeedback } from "../src/prompt.ts";

describe("review prompt", () => {
	it("detects whether feedback exists", () => {
		expect(hasReviewFeedback({ type: "submit", overallComment: "", comments: [] })).toBe(false);
		expect(hasReviewFeedback({ type: "submit", overallComment: "note", comments: [] })).toBe(true);
	});

	it("formats branch, commit, and file comments", () => {
		const prompt = composeReviewPrompt({ type: "submit", overallComment: "Overall", comments: [{ tab: "branch", id: "1", label: "src/a.ts", body: "branch note" }, { tab: "commits", id: "2", label: "abc123 Fix bug", body: "commit note" }, { tab: "files", id: "3", label: "src/b.ts", body: "file note" }] });
		expect(prompt).toContain("[branch diff] src/a.ts");
		expect(prompt).toContain("[commit] abc123 Fix bug");
		expect(prompt).toContain("[current file] src/b.ts");
	});
});
