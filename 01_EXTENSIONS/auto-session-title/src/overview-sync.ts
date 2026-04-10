import { buildConversationTranscript, resolveSessionOverview } from "./summarize.js";
import { OVERVIEW_CUSTOM_TYPE } from "./overview-constants.js";
import { buildTerminalTitle } from "./title.js";
import { ensureOverviewOverlay, clearOverlayState } from "./overlay-state.js";
import { findLatestOverview, getEntriesSince } from "./overview-entry.js";
import type { OverviewContext, OverviewRuntime, PersistedOverview } from "./overview-types.js";

function sameSummary(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((line, index) => line === right[index]);
}

function resolveFallbackTitle(previous: PersistedOverview | undefined, runtime: OverviewRuntime, ctx: OverviewContext): string | undefined {
	return previous?.title || runtime.getSessionName() || ctx.sessionManager.getSessionName();
}

function syncTerminalTitle(ctx: OverviewContext, title?: string): void {
	if (ctx.hasUI && title) ctx.ui.setTitle(buildTerminalTitle(title));
}

export function restoreOverview(runtime: OverviewRuntime, ctx: OverviewContext): void {
	const overview = findLatestOverview(ctx.sessionManager.getBranch());
	if (overview && runtime.getSessionName() !== overview.title) runtime.setSessionName(overview.title);
	const title = resolveFallbackTitle(overview, runtime, ctx);
	ensureOverviewOverlay(ctx, overview, title);
	syncTerminalTitle(ctx, title);
}

export async function refreshOverview(inFlight: Set<string>, runtime: OverviewRuntime, ctx: OverviewContext): Promise<void> {
	const sessionId = ctx.sessionManager.getSessionId();
	if (inFlight.has(sessionId)) return;
	inFlight.add(sessionId);
	try {
		const branch = ctx.sessionManager.getBranch();
		const previous = findLatestOverview(branch);
		const recentText = buildConversationTranscript(getEntriesSince(branch, previous?.entryId));
		if (!recentText) return restoreOverview(runtime, ctx);
		const next = await resolveSessionOverview({ recentText, previous, model: ctx.model, modelRegistry: ctx.modelRegistry });
		if (!next) return restoreOverview(runtime, ctx);
		const changed = !previous || previous.title !== next.title || !sameSummary(previous.summary, next.summary);
		if (changed) runtime.appendEntry(OVERVIEW_CUSTOM_TYPE, next);
		if (runtime.getSessionName() !== next.title) runtime.setSessionName(next.title);
		ensureOverviewOverlay(ctx, next, next.title);
		syncTerminalTitle(ctx, next.title);
	} finally {
		inFlight.delete(sessionId);
	}
}

export function clearOverviewUi(inFlight: Set<string>, _ctx?: OverviewContext): void {
	inFlight.clear();
	clearOverlayState();
}
