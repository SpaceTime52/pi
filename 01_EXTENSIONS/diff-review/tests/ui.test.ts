import { describe, expect, it } from "vitest";
import { buildReviewHtml } from "../src/ui.ts";

describe("buildReviewHtml", () => {
	it("inlines the review payload and script", () => {
		const html = buildReviewHtml({ repoRoot: "/repo", baseRef: "origin/main", mergeBase: "abc", hasHead: true, files: [], commits: [] });
		expect(html).toContain("/repo");
		expect(html).toContain("window.__diffReviewReceive");
		expect(html).not.toContain('"__INLINE_DATA__"');
	});
});
