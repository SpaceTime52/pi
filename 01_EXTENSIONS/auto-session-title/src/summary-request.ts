import type { SessionOverview } from "./overview-types.js";
import { normalizeTitle } from "./title.js";

const REQUEST_PREFIX = /^(?:요청|Request):\s*/u;
const REQUEST_MAX_LENGTH = 72;

function extractLatestUserRequest(recentText: string): string | undefined {
	const lines = recentText.split(/\r?\n/);
	for (let i = lines.length - 1; i >= 0; i--) {
		const line = lines[i]!.trim();
		if (!line.startsWith("User: ")) continue;
		const request = normalizeTitle(line.slice(6), REQUEST_MAX_LENGTH);
		if (request) return request;
	}
}

function buildRequestLine(request: string): string {
	return `${/[가-힣]/u.test(request) ? "요청" : "Request"}: ${request}`;
}

export function ensureOverviewRequestLine(overview: SessionOverview, recentText: string): SessionOverview {
	if (overview.summary.length === 0) return overview;
	const request = extractLatestUserRequest(recentText);
	if (!request) return overview;
	const requestLine = buildRequestLine(request);
	const summary = [requestLine, ...overview.summary.filter((line) => !REQUEST_PREFIX.test(line) && line !== requestLine)].slice(0, 4);
	return summary.length === overview.summary.length && summary.every((line, index) => line === overview.summary[index])
		? overview
		: { ...overview, summary };
}
