import { findLatestOverview } from "./overview-entry.js";
import { ensureOverviewOverlay } from "./overlay-state.js";
import { buildTerminalTitle, normalizeTitle } from "./title.js";
import type { OverviewContext, SessionOverview } from "./overview-types.js";

function collapseWhitespace(text: string): string {
	return text.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
}

function isRoutineInput(text: string): boolean {
	return /^(?:안녕(?:하세요)?|반가워(?:요)?|hi|hello|hey|thanks|thank you|고마워(?:요)?|감사(?:합니다|해요)?)$/iu.test(text.replace(/[.!?~]+$/u, ""));
}

function buildPreviewOverview(text: string): SessionOverview | undefined {
	const summary = collapseWhitespace((text.replace(/```[\s\S]*?```/g, " ").split(/\r?\n\s*\r?\n/).find((part) => part.trim()) ?? ""));
	if (!summary || summary.startsWith("/") || summary.startsWith("!") || isRoutineInput(summary)) return undefined;
	const title = normalizeTitle(summary);
	if (!title) return undefined;
	return { title, summary: [summary] };
}

function syncTitle(ctx: OverviewContext, title: string): void {
	if (ctx.hasUI) ctx.ui.setTitle(buildTerminalTitle(title));
}

export function previewOverviewFromInput(ctx: OverviewContext, text: string): boolean {
	if (findLatestOverview(ctx.sessionManager.getBranch())) return false;
	const preview = buildPreviewOverview(text);
	if (!preview) return false;
	ensureOverviewOverlay(ctx, preview, preview.title);
	syncTitle(ctx, preview.title);
	return true;
}
