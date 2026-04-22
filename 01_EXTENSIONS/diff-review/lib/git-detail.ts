import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { truncateText } from "../src/truncate.js";
import type { ReviewCommandApi, ReviewData, ReviewDetail, ReviewFile, ReviewTab } from "../src/types.js";

async function runBashAllowFailure(pi: Pick<ReviewCommandApi, "exec">, cwd: string, script: string): Promise<string> {
	const result = await pi.exec("bash", ["-lc", script], { cwd });
	return result.code === 0 ? result.stdout : "";
}

function snapshotDiffScript(base: string | null, path: string | null): string {
	const target = path ? ` -- '${path.replace(/'/gu, `'\\''`)}'` : " --";
	const header = ["set -euo pipefail", 'tmp=$(mktemp "/tmp/pi-diff-review-index.XXXXXX")', "trap 'rm -f \"$tmp\"' EXIT", 'export GIT_INDEX_FILE="$tmp"'];
	const readTree = base ? [`git read-tree '${base}'`] : ["rm -f \"$tmp\""];
	const diff = base ? `git diff --cached --find-renames -M '${base}'${target}` : `git diff --cached --find-renames -M --root${target}`;
	return [...header, ...readTree, "git add -A -- .", diff].join("\n");
}

async function loadCurrentFile(repoRoot: string, file: ReviewFile, data: ReviewData, pi: Pick<ReviewCommandApi, "exec">): Promise<string> {
	const livePath = file.newPath ?? file.oldPath;
	if (livePath && file.present) return readFile(join(repoRoot, livePath), "utf8").catch(() => "");
	if (data.hasHead && file.oldPath) return runBashAllowFailure(pi, repoRoot, `git show HEAD:'${file.oldPath.replace(/'/gu, `'\\''`)}'`);
	if (data.mergeBase && file.oldPath) return runBashAllowFailure(pi, repoRoot, `git show '${data.mergeBase}:${file.oldPath.replace(/'/gu, `'\\''`)}'`);
	return "File is not present in the current working tree.";
}

export async function loadReviewDetail(pi: Pick<ReviewCommandApi, "exec">, data: ReviewData, tab: ReviewTab, id: string): Promise<ReviewDetail> {
	if (tab === "commits") {
		const commit = data.commits.find((item) => item.sha === id);
		if (!commit) throw new Error("Unknown commit requested.");
		const content = commit.kind === "working-tree" ? await runBashAllowFailure(pi, data.repoRoot, snapshotDiffScript(data.hasHead ? "HEAD" : null, null)) : await runBashAllowFailure(pi, data.repoRoot, `git show --stat --patch --find-renames -M '${id}'`);
		return { title: `[commit] ${commit.shortSha} ${commit.subject}`.trim(), content: truncateText(content || "No diff available.") };
	}
	const file = data.files.find((item) => item.id === id);
	if (!file) throw new Error("Unknown file requested.");
	const title = `${tab === "branch" ? "[branch diff]" : "[current file]"} ${file.path}`;
	const content = tab === "branch" ? await runBashAllowFailure(pi, data.repoRoot, snapshotDiffScript(data.mergeBase, file.path)) : await loadCurrentFile(data.repoRoot, file, data, pi);
	return { title, content: truncateText(content || "No content available.") };
}
