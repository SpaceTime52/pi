import { describe, expect, it } from "vitest";
import { getCommitFiles, getReviewData } from "../src/git-review-data.ts";

function createApi(map: Record<string, { code: number; stdout: string; stderr?: string }>) {
	return { exec: async (command: string, args: string[]) => { const key = [command, ...args].join(" "); const result = map[key]; return result ? { ...result, stderr: result.stderr ?? "" } : { code: 1, stdout: "", stderr: "" }; } };
}

describe("review data", () => {
	it("collects branch files and commits", async () => {
		const api = createApi({ "git rev-parse --show-toplevel": { code: 0, stdout: "/repo\n" }, "git rev-parse --verify HEAD": { code: 0, stdout: "head\n" }, "git branch --show-current": { code: 0, stdout: "feature\n" }, "git rev-parse --abbrev-ref --symbolic-full-name @{upstream}": { code: 0, stdout: "origin/main\n" }, "git symbolic-ref refs/remotes/origin/HEAD --short": { code: 1, stdout: "" }, "git merge-base HEAD origin/main": { code: 0, stdout: "base123\n" }, "git diff --find-renames -M --name-status base123 --": { code: 0, stdout: "M\tsrc/a.ts\n" }, "git log -100 --format=%H\u001f%h\u001f%s\u001f%an\u001f%aI base123..HEAD": { code: 0, stdout: "sha1\u001fabcd123\u001fCommit title\u001fme\u001f2024-01-01\n" }, "git status --porcelain=1 --untracked-files=all -z": { code: 0, stdout: "?? src/new.ts\u0000 M src/a.ts\u0000" } });
		const data = await getReviewData(api, "/repo");
		expect(data.branchBaseRef).toBe("origin/main");
		expect(data.branchMergeBaseSha).toBe("base123");
		expect(data.files.map((file) => file.path)).toEqual(["src/a.ts", "src/new.ts"]);
		expect(data.commits.map((commit) => commit.shortSha)).toEqual(["WT", "abcd123"]);
	});

	it("loads commit files for normal and working-tree commits", async () => {
		const api = createApi({ "git rev-parse --show-toplevel": { code: 0, stdout: "/repo\n" }, "git diff-tree --root --find-renames -M --name-status --no-commit-id -r sha1": { code: 0, stdout: "M\tsrc/a.ts\nA\tsrc/new.ts\n" }, "git rev-parse --verify HEAD": { code: 0, stdout: "head\n" }, "bash -lc set -euo pipefail\ntmp_index=$(mktemp \"/tmp/pi-diff-review-index.XXXXXX\")\ntrap 'rm -f \"$tmp_index\"' EXIT\nexport GIT_INDEX_FILE=\"$tmp_index\"\ngit read-tree 'HEAD'\ngit add -A -- .\ngit diff --cached --find-renames -M --name-status 'HEAD' --": { code: 0, stdout: "M\tsrc/a.ts\nA\tsrc/new.ts\n" } });
		expect((await getCommitFiles(api, "/repo", "sha1")).map((file) => file.path)).toEqual(["src/a.ts", "src/new.ts"]);
		expect((await getCommitFiles(api, "/repo", "__pi_working_tree__")).map((file) => file.path)).toEqual(["src/a.ts", "src/new.ts"]);
	});
});
