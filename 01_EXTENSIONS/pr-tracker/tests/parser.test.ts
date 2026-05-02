import { describe, expect, it } from "vitest";
import { extractPullRequestRef, extractTextContent, isPullRequestCreationCommand, splitArgs } from "../src/parser.ts";

describe("parser", () => {
	it("extracts GitHub pull request URLs", () => {
		expect(extractPullRequestRef("created https://github.com/acme/web/pull/63")?.ref).toBe(
			"https://github.com/acme/web/pull/63",
		);
		expect(extractPullRequestRef("created https://github.com/acme/web/pull/63")?.number).toBe(63);
	});

	it("extracts textual PR numbers", () => {
		expect(extractPullRequestRef("Created pull request #12")?.ref).toBe("12");
		expect(extractPullRequestRef("PR #7 is ready")?.number).toBe(7);
	});

	it("detects gh pr create commands", () => {
		expect(isPullRequestCreationCommand("gh pr create --fill")).toBe(true);
		expect(isPullRequestCreationCommand("git status && gh pr create")).toBe(true);
		expect(isPullRequestCreationCommand("gh pr view 1")).toBe(false);
	});

	it("extracts text blocks from tool content", () => {
		expect(extractTextContent([{ type: "text", text: "one" }, { type: "image", data: "x" }, { type: "text", text: "two" }])).toBe(
			"one\ntwo",
		);
	});

	it("splits quoted command arguments", () => {
		expect(splitArgs('merge --squash --subject "ship it" --body a\\ b')).toEqual([
			"merge",
			"--squash",
			"--subject",
			"ship it",
			"--body",
			"a b",
		]);
	});
});
