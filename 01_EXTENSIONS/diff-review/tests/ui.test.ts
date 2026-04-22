import { describe, expect, it } from "vitest";
import { buildReviewHtml } from "../src/ui.ts";

describe("buildReviewHtml", () => {
	it("inlines the review payload, css, and scripts", () => {
		const html = buildReviewHtml({ repoRoot: "/repo", branchBaseRef: "origin/main", branchMergeBaseSha: "abc", repositoryHasHead: true, files: [], commits: [] });
		expect(html).toContain("/repo");
		expect(html).toContain("window.__reviewReceive");
		expect(html).toContain("html,body{width:100%;height:100%;overflow:hidden;}");
		expect(html).toContain("loader.min.js");
		expect(html).not.toContain('"__INLINE_DATA__"');
	});
});
