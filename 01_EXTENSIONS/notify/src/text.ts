const GENERIC_HEADINGS = new Set([
	"done",
	"completed",
	"summary",
	"summaries",
	"result",
	"results",
	"update",
	"updates",
	"요약",
	"완료",
	"결과",
	"변경사항",
]);

export function sanitizeNotificationText(text: string): string {
	return text
		.replace(/[\r\n\t]+/g, " ")
		.replace(/[\x00-\x1f\x7f;]+/g, " ")
		.replace(/ +/g, " ")
		.trim();
}

export function stripMarkdownBlocks(text: string): string {
	return text.replace(/```[\s\S]*?```/g, " ");
}

function stripMarkdownInline(text: string): string {
	return text
		.replace(/`([^`]*)`/g, "$1")
		.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
		.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
		.replace(/[>*_~#]+/g, " ");
}

export function cleanSummaryLine(line: string): string {
	return sanitizeNotificationText(
		stripMarkdownInline(line)
			.replace(/^\s{0,3}(?:[-*+] |\d+[.)] |#{1,6} )/u, "")
			.replace(/^\s*\[[ xX]\]\s+/u, ""),
	);
}

export function truncateAtWord(text: string, maxLength: number): string {
	if (text.length <= maxLength) return text;
	const clipped = text.slice(0, Math.max(1, maxLength - 1));
	const lastSpace = clipped.lastIndexOf(" ");
	return `${(lastSpace > 32 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}…`;
}

export function extractSummaryCandidates(lines: string[]): string[] {
	return lines
		.flatMap((line) => line.match(/[^.!?。！？]+[.!?。！？]?/gu) ?? [line])
		.map((item) => sanitizeNotificationText(item.replace(/[.!?。！？]+$/u, "")))
		.filter(Boolean);
}

export function isGenericHeading(line: string): boolean {
	return GENERIC_HEADINGS.has(line.toLowerCase());
}

export function stripSummaryLabel(line: string): string {
	return line.replace(/^(?:summary|result|update|요약|정리|결과)\s*[:：-]\s*/iu, "").trim();
}

export function hasKoreanText(text: string): boolean {
	return /[가-힣]/u.test(text);
}
