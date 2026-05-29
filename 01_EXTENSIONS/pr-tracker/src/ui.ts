import { EXTENSION_ID, type CheckSummary, type PullRequestStatus, type TrackerContext, type TrackerState } from "./types.js";

function truncate(text: string, maxLength: number): string {
	return text.length <= maxLength ? text : `${text.slice(0, Math.max(0, maxLength - 1))}…`;
}

export function sanitizeHyperlinkUrl(url: string): string {
	let safeUrl = "";
	for (const char of url) {
		const code = char.charCodeAt(0);
		if (code >= 32 && code !== 127) safeUrl += char;
	}
	return safeUrl;
}

export function hyperlink(text: string, url: string): string {
	return `\u001B]8;;${sanitizeHyperlinkUrl(url)}\u0007${text}\u001B]8;;\u0007`;
}

export function formatPullRequestNumber(pr: Pick<PullRequestStatus, "number" | "url">): string {
	const label = `#${pr.number}`;
	return pr.url ? hyperlink(label, pr.url) : label;
}

export function formatChecks(checks: CheckSummary): string {
	if (checks.total === 0) return "Checks —";
	if (checks.state === "passing") return `Checks ✓ ${checks.passed}/${checks.total}`;
	if (checks.state === "failing") return `Checks ✗ ${checks.failed}/${checks.total}`;
	if (checks.state === "pending") return `Checks … ${checks.pending}/${checks.total}`;
	return `Checks ? ${checks.passed}/${checks.total}`;
}

export function formatPullRequestDetails(pr: PullRequestStatus): string {
	const segments = [formatChecks(pr.checks), pr.review.label];
	if (pr.changedFiles !== undefined) segments.push(`Changes ${pr.changedFiles}`);
	if (pr.additions !== undefined || pr.deletions !== undefined) segments.push(`+${pr.additions ?? 0}/-${pr.deletions ?? 0}`);
	if (pr.headRefName && pr.baseRefName) segments.push(`${pr.headRefName} → ${pr.baseRefName}`);
	return segments.join(" · ");
}

export function renderWidgetLines(state: TrackerState): string[] | undefined {
	const pr = state.pr;
	if (!pr) return undefined;
	const title = pr.title ? ` · ${truncate(pr.title, 72)}` : "";
	const lines = [`${formatPullRequestNumber(pr)} ${pr.readiness.label}${title}`];
	if (pr.url) lines.push(`  ${pr.url}`);
	lines.push(`  ${formatPullRequestDetails(pr)}`);
	if (state.lastError) lines.push(`  Last refresh failed: ${truncate(state.lastError, 100)}`);
	lines.push("  /pr refresh · /pr open · /pr merge · /pr untrack");
	return lines;
}

export function formatStatus(state: TrackerState): string | undefined {
	const pr = state.pr;
	if (!pr) return undefined;
	return `PR ${formatPullRequestNumber(pr)} ${pr.readiness.label}`;
}

export function formatNotification(state: TrackerState): string {
	const pr = state.pr;
	if (!pr) return state.lastError ? `No tracked PR (${state.lastError})` : "No tracked PR";
	return `${formatPullRequestNumber(pr)} ${pr.readiness.label}\n${formatPullRequestDetails(pr)}${pr.url ? `\n${pr.url}` : ""}`;
}

export function syncTrackerUi(ctx: Pick<TrackerContext, "hasUI" | "ui">, state: TrackerState): void {
	if (!ctx.hasUI) return;
	ctx.ui.setWidget(EXTENSION_ID, renderWidgetLines(state));
	ctx.ui.setStatus(EXTENSION_ID, formatStatus(state));
}
