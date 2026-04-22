import { findReviewBase, getRepoRoot, hasHead, listCommits } from "./git-base.js";
import { parseNameStatus } from "./git-parse.js";
import type { ReviewCommandApi, ReviewCommit, ReviewData } from "../src/types.js";

const WORKING_TREE_SHA = "__pi_working_tree__";

async function runBashAllowFailure(pi: Pick<ReviewCommandApi, "exec">, cwd: string, script: string): Promise<string> {
	const result = await pi.exec("bash", ["-lc", script], { cwd });
	return result.code === 0 ? result.stdout : "";
}

async function workingTreeStatus(pi: Pick<ReviewCommandApi, "exec">, cwd: string): Promise<boolean> {
	return (await pi.exec("git", ["status", "--porcelain=1", "--untracked-files=all"], { cwd })).stdout.trim().length > 0;
}

function parseCommits(output: string): ReviewCommit[] {
	return output.split(/\r?\n/u).filter(Boolean).map((line) => {
		const [sha, shortSha, subject, author, date] = line.split("\u001f");
		return { sha, shortSha, subject, author, date, kind: "commit" } satisfies ReviewCommit;
	});
}

function snapshotScript(base: string | null): string {
	return [
		"set -euo pipefail",
		'tmp=$(mktemp "/tmp/pi-diff-review-index.XXXXXX")',
		"trap 'rm -f \"$tmp\"' EXIT",
		'export GIT_INDEX_FILE="$tmp"',
		...(base ? [`git read-tree '${base}'`] : ["rm -f \"$tmp\""]),
		"git add -A -- .",
		base ? `git diff --cached --find-renames -M --name-status '${base}' --` : "git diff --cached --find-renames -M --name-status --root --",
	].join("\n");
}

export async function getReviewData(pi: Pick<ReviewCommandApi, "exec">, cwd: string): Promise<ReviewData> {
	const repoRoot = await getRepoRoot(pi, cwd);
	const repoHasHead = await hasHead(pi, repoRoot);
	const reviewBase = repoHasHead ? await findReviewBase(pi, repoRoot) : null;
	const mergeBase = reviewBase?.mergeBase ?? (repoHasHead ? "HEAD" : null);
	const files = parseNameStatus(await runBashAllowFailure(pi, repoRoot, snapshotScript(mergeBase)));
	const range = reviewBase ? `${reviewBase.mergeBase}..HEAD` : repoHasHead ? "HEAD" : "";
	const commits = range ? parseCommits(await listCommits(pi, repoRoot, range)) : [];
	const workingCommit = await workingTreeStatus(pi, repoRoot);
	return {
		repoRoot,
		baseRef: reviewBase?.baseRef ?? null,
		mergeBase,
		hasHead: repoHasHead,
		files,
		commits: workingCommit ? [{ sha: WORKING_TREE_SHA, shortSha: "WT", subject: "Uncommitted changes", author: "", date: "", kind: "working-tree" }, ...commits] : commits,
	};
}
