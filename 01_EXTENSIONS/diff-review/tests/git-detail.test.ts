import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadReviewDetail } from "../src/git-detail.ts";
import type { ReviewData, ReviewFile } from "../src/types.ts";

function createData(repoRoot: string, file: ReviewFile): ReviewData {
	return { repoRoot, baseRef: "origin/main", mergeBase: "base123", hasHead: true, files: [file], commits: [{ sha: "__pi_working_tree__", shortSha: "WT", subject: "Uncommitted changes", author: "", date: "", kind: "working-tree" }, { sha: "sha1", shortSha: "sha1", subject: "Commit", author: "me", date: "2024", kind: "commit" }] };
}

describe("loadReviewDetail", () => {
	it("loads commit and branch details", async () => {
		const repoRoot = String(await mkdir(join(tmpdir(), `pi-diff-${Date.now()}`), { recursive: true }));
		await writeFile(join(repoRoot, "src.ts"), "console.log('hi')\n");
		const file = { id: "file1", path: "src.ts", status: "modified", oldPath: "src.ts", newPath: "src.ts", present: true } satisfies ReviewFile;
		const api = { exec: async (command: string) => ({ code: 0, stdout: command === "bash" ? "diff --git a/src.ts b/src.ts\n" : "commit patch\n", stderr: "" }) };
		await expect(loadReviewDetail(api, createData(repoRoot, file), "commits", "sha1")).resolves.toMatchObject({ title: "[commit] sha1 Commit" });
		await expect(loadReviewDetail(api, createData(repoRoot, file), "branch", "file1")).resolves.toMatchObject({ title: "[branch diff] src.ts" });
		await expect(loadReviewDetail(api, createData(repoRoot, file), "commits", "__pi_working_tree__")).resolves.toMatchObject({ title: "[commit] WT Uncommitted changes" });
		await expect(loadReviewDetail(api, createData(repoRoot, file), "commits", "missing")).rejects.toThrow("Unknown commit requested.");
	});

	it("loads current files and rejects unknown ids", async () => {
		const repoRoot = String(await mkdir(join(tmpdir(), `pi-diff-${Date.now()}-2`), { recursive: true }));
		const file = { id: "file1", path: "gone.ts", status: "deleted", oldPath: "gone.ts", newPath: null, present: false } satisfies ReviewFile;
		const api = { exec: async () => ({ code: 0, stdout: "from git\n", stderr: "" }) };
		await expect(loadReviewDetail(api, createData(repoRoot, file), "files", "file1")).resolves.toMatchObject({ title: "[current file] gone.ts", content: "from git\n" });
		await expect(loadReviewDetail(api, createData(repoRoot, file), "files", "missing")).rejects.toThrow("Unknown file requested.");
		await expect(loadReviewDetail(api, { ...createData(repoRoot, file), hasHead: false, mergeBase: null }, "files", "file1")).resolves.toMatchObject({ content: "File is not present in the current working tree." });
		await expect(loadReviewDetail({ exec: async () => ({ code: 1, stdout: "", stderr: "" }) }, createData(repoRoot, { ...file, id: "file2", path: "missing.ts", oldPath: "missing.ts", present: true }), "files", "file2")).resolves.toMatchObject({ content: "No content available." });
	});
});
