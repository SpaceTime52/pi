import type { ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import { getCommitFiles } from "./git-commit-files.js";
import { loadReviewFileContents } from "./git-file-contents.js";
import { getReviewData, isWorkingTreeCommitSha } from "./git-review-data.js";
import { isCancel, isRequestCommit, isRequestFile, isRequestReviewData, isSubmit } from "./message-guards.js";
import { composeReviewPrompt, hasReviewFeedback } from "./prompt.js";
import { openQuietGlimpse, type QuietGlimpseWindow } from "./glimpse-window.js";
import { sendWindowMessage } from "./window-send.js";
import type { ReviewCommandApi, ReviewFile, ReviewFileContents, ReviewHostMessage } from "../src/types.js";
import { buildReviewHtml } from "../src/ui.js";

function appendPrompt(ctx: ExtensionCommandContext, prompt: string): void {
	ctx.ui.pasteToEditor(`${ctx.ui.getEditorText().trim().length > 0 ? "\n\n" : ""}${prompt}`);
}

export default function registerDiffReview(_pi: ReviewCommandApi) {
	let activeWindow: QuietGlimpseWindow | null = null;
	const suppressed = new WeakSet<QuietGlimpseWindow>();
	const closeWindow = (options: { suppressResults?: boolean } = {}) => { if (!activeWindow) return; const window = activeWindow; activeWindow = null; if (options.suppressResults) suppressed.add(window); try { window.close(); } catch {} };
	const reviewRepository = async (ctx: ExtensionCommandContext) => {
		if (activeWindow) return void ctx.ui.notify("A review window is already open.", "warning");
		try {
			let reviewData = await getReviewData(_pi, ctx.cwd); const { repoRoot } = reviewData;
			if (reviewData.files.length === 0 && reviewData.commits.length === 0) return void ctx.ui.notify("No reviewable files found.", "info");
			const window = await openQuietGlimpse(buildReviewHtml(reviewData), { width: 1680, height: 1020, title: "pi review" }); activeWindow = window;
			const fileMap = new Map(reviewData.files.map((file) => [file.id, file])); const commitCache = new Map<string, Promise<ReviewFile[]>>(); const contentCache = new Map<string, Promise<ReviewFileContents>>();
			const clearRefreshableCaches = () => { contentCache.clear(); for (const sha of commitCache.keys()) if (isWorkingTreeCommitSha(sha)) commitCache.delete(sha); };
			const send = (message: ReviewHostMessage) => { if (activeWindow === window) sendWindowMessage(window, message); };
			const loadCommitFiles = (sha: string) => { const cached = commitCache.get(sha); if (cached) return cached; const pending = getCommitFiles(_pi, repoRoot, sha); commitCache.set(sha, pending); pending.then((files) => files.forEach((file) => fileMap.set(file.id, file))).catch(() => {}); return pending; };
			const loadContents = (file: ReviewFile, scope: "branch" | "commits" | "all", commitSha: string | null) => { const key = `${scope}:${commitSha ?? ""}:${file.id}`; const cached = contentCache.get(key); if (cached) return cached; const pending = loadReviewFileContents(_pi, repoRoot, file, scope, commitSha, reviewData.branchMergeBaseSha); contentCache.set(key, pending); return pending; };
			const terminalMessagePromise = new Promise<unknown | null>((resolve, reject) => { let settled = false; let closeTimer: ReturnType<typeof setTimeout> | null = null; const cleanup = () => { if (closeTimer) clearTimeout(closeTimer); window.removeListener("message", onMessage); window.removeListener("closed", onClosed); window.removeListener("error", onError); if (activeWindow === window) activeWindow = null; }; const settle = (value: unknown | null) => { if (settled) return; settled = true; cleanup(); resolve(value); }; const onMessage = (message: unknown) => { if (isRequestFile(message)) return void loadContents(fileMap.get(message.fileId) ?? (() => { throw new Error("Unknown file requested."); })(), message.scope, message.commitSha ?? null).then((contents) => send({ type: "file-data", requestId: message.requestId, fileId: message.fileId, scope: message.scope, commitSha: message.commitSha ?? null, ...contents })).catch((error) => send({ type: "file-error", requestId: message.requestId, fileId: message.fileId, scope: message.scope, commitSha: message.commitSha ?? null, message: error instanceof Error ? error.message : String(error) })); if (isRequestCommit(message)) return void loadCommitFiles(message.sha).then((files) => send({ type: "commit-data", requestId: message.requestId, sha: message.sha, files })).catch((error) => send({ type: "commit-error", requestId: message.requestId, sha: message.sha, message: error instanceof Error ? error.message : String(error) })); if (isRequestReviewData(message)) return void (clearRefreshableCaches(), getReviewData(_pi, repoRoot).then((data) => { reviewData = data; data.files.forEach((file) => fileMap.set(file.id, file)); send({ type: "review-data", requestId: message.requestId, files: data.files, commits: data.commits, branchBaseRef: data.branchBaseRef, branchMergeBaseSha: data.branchMergeBaseSha, repositoryHasHead: data.repositoryHasHead }); })); if (isSubmit(message) || isCancel(message)) settle(message); }; const onClosed = () => { if (settled || closeTimer) return; closeTimer = setTimeout(() => settle(null), 250); }; const onError = (error: Error) => { if (settled) return; settled = true; cleanup(); reject(error); }; window.on("message", onMessage); window.on("closed", onClosed); window.on("error", onError); });
			void (async () => { try { const message = await terminalMessagePromise; if (suppressed.has(window) || message == null) return; if (isCancel(message)) return void ctx.ui.notify("Review cancelled.", "info"); if (!isSubmit(message) || !hasReviewFeedback(message)) return; appendPrompt(ctx, composeReviewPrompt([...fileMap.values()], message)); ctx.ui.notify("Appended review feedback to the editor.", "info"); } catch (error) { if (!suppressed.has(window)) ctx.ui.notify(`Review failed: ${error instanceof Error ? error.message : String(error)}`, "error"); } })();
			ctx.ui.notify("Opened native review window.", "info");
		} catch (error) { closeWindow({ suppressResults: true }); ctx.ui.notify(`Review failed: ${error instanceof Error ? error.message : String(error)}`, "error"); }
	};
	_pi.registerCommand("diff-review", { description: "Open a native review window with branch, per-commit, and all-files scopes", handler: async (_args, ctx) => { await reviewRepository(ctx); } });
	_pi.on("session_shutdown", async () => { closeWindow({ suppressResults: true }); });
}
