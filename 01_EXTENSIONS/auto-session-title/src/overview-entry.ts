import { OVERVIEW_CUSTOM_TYPE } from "./overview-constants.js";
import type { OverviewEntry, PersistedOverview, SessionOverview } from "./overview-types.js";

function normalizeSummaryLine(line: unknown): string | undefined {
	if (typeof line !== "string") return undefined;
	const collapsed = line.replace(/^[-*•]\s*/, "").replace(/\s+/g, " ").trim();
	if (!collapsed) return undefined;
	return collapsed.length > 120 ? `${collapsed.slice(0, 119).trimEnd()}…` : collapsed;
}

function normalizeOverviewData(data: object | null | undefined): SessionOverview | undefined {
	const record = data && typeof data === "object" ? data as { title?: unknown; summary?: unknown } : undefined;
	const title = typeof record?.title === "string" ? record.title.trim() : "";
	const summary = Array.isArray(record?.summary)
		? record.summary.map(normalizeSummaryLine).filter((line): line is string => Boolean(line)).slice(0, 4)
		: [];
	return title && summary.length > 0 ? { title, summary } : undefined;
}

export function findLatestOverview(branch: OverviewEntry[]): PersistedOverview | undefined {
	for (let i = branch.length - 1; i >= 0; i--) {
		const entry = branch[i]!;
		if (entry.type !== "custom" || entry.customType !== OVERVIEW_CUSTOM_TYPE) continue;
		const overview = normalizeOverviewData(entry.data);
		if (overview) return { entryId: entry.id, ...overview };
	}
}

export function getEntriesSince(branch: OverviewEntry[], checkpointEntryId?: string): OverviewEntry[] {
	if (!checkpointEntryId) return branch;
	const index = branch.findIndex((entry) => entry.id === checkpointEntryId);
	return index < 0 ? branch : branch.slice(index + 1);
}

export function buildOverviewBodyLines(overview?: SessionOverview, fallbackTitle?: string): string[] {
	const title = overview?.title || fallbackTitle || "이름 없는 세션";
	const lines = overview?.summary ?? ["요약이 아직 없습니다.", "다음 응답이 끝나면 자동으로 정리됩니다."];
	return [`제목: ${title}`, ...lines.map((line) => `• ${line}`)];
}

export function buildOverviewWidgetText(overview?: SessionOverview, fallbackTitle?: string): string {
	return ["세션 요약", ...buildOverviewBodyLines(overview, fallbackTitle)].join("\n");
}
