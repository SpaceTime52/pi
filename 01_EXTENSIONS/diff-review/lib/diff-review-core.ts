import type { ExtensionCommandContext, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { getReviewData } from "./git-review-data.js";
import { loadReviewDetail } from "./git-detail.js";
import { composeReviewPrompt, hasReviewFeedback } from "../src/prompt.js";
import type { ReviewCommandApi, ReviewHostMessage, ReviewWindowMessage } from "../src/types.js";
import { buildReviewHtml } from "../src/ui.js";
import { openQuietGlimpse, type QuietGlimpseWindow } from "./glimpse-window.js";

function isReviewWindowMessage(message: unknown): message is ReviewWindowMessage {
	return !!message && typeof message === "object" && "type" in message;
}

function appendPrompt(ctx: ExtensionCommandContext, prompt: string): void {
	ctx.ui.pasteToEditor(`${ctx.ui.getEditorText().trim() ? "\n\n" : ""}${prompt}`);
}

function send(window: QuietGlimpseWindow, message: ReviewHostMessage): void {
	const payload = JSON.stringify(message).replace(/</gu, "\\u003c").replace(/>/gu, "\\u003e").replace(/&/gu, "\\u0026");
	window.send(`window.__diffReviewReceive(${payload});`);
}

export default function registerDiffReview(_pi: ReviewCommandApi) {
	let activeWindow: QuietGlimpseWindow | null = null;
	const ignored = new WeakSet<QuietGlimpseWindow>();
	const closeWindow = (suppress = false) => {
		if (!activeWindow) return;
		const window = activeWindow;
		activeWindow = null;
		if (suppress) ignored.add(window);
		window.close();
	};
	const handleCommand = async (_args: string, ctx: ExtensionCommandContext) => {
		if (activeWindow) return void ctx.ui.notify("A diff review window is already open.", "warning");
		try {
			const data = await getReviewData(_pi, ctx.cwd);
			if (data.files.length === 0 && data.commits.length === 0) return void ctx.ui.notify("No reviewable changes found.", "info");
			const window = await openQuietGlimpse(buildReviewHtml(data), { width: 1500, height: 960, title: "pi diff review" });
			activeWindow = window;
			window.on("message", async (message: unknown) => {
				if (!isReviewWindowMessage(message)) return;
				if (message.type === "detail") {
					try {
						const detail = await loadReviewDetail(_pi, data, message.tab, message.id);
						send(window, { type: "detail-data", requestId: message.requestId, tab: message.tab, id: message.id, ...detail });
					} catch (error) {
						send(window, { type: "detail-error", requestId: message.requestId, tab: message.tab, id: message.id, message: error instanceof Error ? error.message : String(error) });
					}
					return;
				}
				if (message.type === "cancel") return void ctx.ui.notify("Diff review cancelled.", "info");
				if (!hasReviewFeedback(message)) return;
				appendPrompt(ctx, composeReviewPrompt(message));
				ctx.ui.notify("Appended diff review feedback to the editor.", "info");
			});
			window.on("closed", () => { if (activeWindow === window) activeWindow = null; });
			window.on("error", (error) => { if (!ignored.has(window)) ctx.ui.notify(`Diff review failed: ${error.message}`, "error"); });
			ctx.ui.notify("Opened diff review window.", "info");
		} catch (error) {
			closeWindow(true);
			ctx.ui.notify(`Diff review failed: ${error instanceof Error ? error.message : String(error)}`, "error");
		}
	};
	_pi.registerCommand("diff-review", { description: "Open a native diff review window for the current repository", handler: handleCommand });
	_pi.on("session_shutdown", (_event: object, _ctx: ExtensionContext) => closeWindow(true));
}
