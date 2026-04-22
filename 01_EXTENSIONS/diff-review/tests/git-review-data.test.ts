import { describe, expect, it } from "vitest";
import { getReviewData } from "../src/git-review-data.ts";

function createApi() {
	const map: Record<string, { code: number; stdout: string; stderr?: string }> = {
		"git rev-parse --show-toplevel": { code: 0, stdout: "/repo\n" },
		"git rev-parse --verify HEAD": { code: 0, stdout: "head\n" },
		"git branch --show-current": { code: 0, stdout: "feature\n" },
		"git rev-parse --abbrev-ref --symbolic-full-name @{upstream}": { code: 0, stdout: "origin/main\n" },
		"git symbolic-ref refs/remotes/origin/HEAD --short": { code: 1, stdout: "" },
		"git merge-base HEAD origin/main": { code: 0, stdout: "base123\n" },
		"git log -100 --format=%H%x1f%h%x1f%s%x1f%an%x1f%aI base123..HEAD": { code: 0, stdout: "sha1\u001fabcd123\u001fCommit title\u001fme\u001f2024-01-01\n" },
		"git status --porcelain=1 --untracked-files=all": { code: 0, stdout: " M src/a.ts\n" },
	};
	return {
		exec: async (command: string, args: string[]) => {
			if (command === "bash") return { code: 0, stdout: "M\tsrc/a.ts\nA\tsrc/new.ts\n", stderr: "" };
			const result = map[[command, ...args].join(" ")];
			return result ? { ...result, stderr: result.stderr ?? "" } : { code: 1, stdout: "", stderr: "" };
		},
	};
}

describe("getReviewData", () => {
	it("collects repo review data including working tree", async () => {
		const data = await getReviewData(createApi(), "/repo");
		expect(data.repoRoot).toBe("/repo");
		expect(data.baseRef).toBe("origin/main");
		expect(data.files.map((file) => file.path)).toEqual(["src/a.ts", "src/new.ts"]);
		expect(data.commits.map((commit) => commit.shortSha)).toEqual(["WT", "abcd123"]);
	});

	it("handles repos without HEAD and branches without a base", async () => {
		const noHeadApi = { exec: async (command: string, args: string[]) => [command, ...args].join(" ") === "git rev-parse --show-toplevel" ? { code: 0, stdout: "/repo\n", stderr: "" } : [command, ...args].join(" ") === "git rev-parse --verify HEAD" ? { code: 1, stdout: "", stderr: "" } : command === "bash" ? { code: 0, stdout: "A\tREADME\n", stderr: "" } : { code: 0, stdout: "", stderr: "" } };
		const noHead = await getReviewData(noHeadApi, "/repo");
		expect(noHead.hasHead).toBe(false);
		expect(noHead.mergeBase).toBeNull();
		expect(noHead.commits).toEqual([]);
		const noBaseApi = { exec: async (command: string, args: string[]) => { const key = [command, ...args].join(" "); if (key === "git rev-parse --show-toplevel") return { code: 0, stdout: "/repo\n", stderr: "" }; if (key === "git rev-parse --verify HEAD") return { code: 0, stdout: "head\n", stderr: "" }; if (key === "git branch --show-current") return { code: 0, stdout: "feature\n", stderr: "" }; if (key === "git status --porcelain=1 --untracked-files=all") return { code: 0, stdout: "", stderr: "" }; if (key.startsWith("git log -100")) return { code: 0, stdout: "", stderr: "" }; return command === "bash" ? { code: 1, stdout: "", stderr: "" } : { code: 1, stdout: "", stderr: "" }; } };
		const noBase = await getReviewData(noBaseApi, "/repo");
		expect(noBase.mergeBase).toBe("HEAD");
		expect(noBase.files).toEqual([]);
		expect(noBase.commits).toEqual([]);
	});
});
