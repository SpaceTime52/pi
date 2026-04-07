export const DEFAULT_MAX_TITLE_LENGTH = 48;

function collapseWhitespace(text: string): string {
	return text
		.replace(/[\r\n\t]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function stripMarkdownNoise(text: string): string {
	return text
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/`+/g, " ");
}

function firstMeaningfulLine(text: string): string {
	const lines = text
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);
	return lines.find((line) => !line.startsWith("```")) ?? "";
}

function stripListPrefix(text: string): string {
	return text.replace(/^(?:[#>*-]+|\d+[.)])\s+/, "");
}

function stripWrappingPunctuation(text: string): string {
	return text
		.replace(/^["'`“”‘’([{]+/, "")
		.replace(/["'`“”‘’)}\].,!?;:]+$/u, "")
		.trim();
}

function takeFirstSentence(text: string): string {
	const match = text.match(/^(.{8,120}?)(?:[.!?。！？](?:\s|$))/u);
	return match?.[1] ?? text;
}

export function truncateTitle(text: string, maxLength: number = DEFAULT_MAX_TITLE_LENGTH): string {
	if (text.length <= maxLength) return text;
	const clipped = text.slice(0, maxLength + 1);
	const lastWordBreak = Math.max(
		clipped.lastIndexOf(" "),
		clipped.lastIndexOf(":"),
		clipped.lastIndexOf("-"),
		clipped.lastIndexOf("—"),
		clipped.lastIndexOf(","),
	);
	const cutoff = lastWordBreak >= Math.floor(maxLength * 0.6) ? lastWordBreak : maxLength;
	return `${clipped.slice(0, cutoff).trimEnd()}…`;
}

export function deriveSessionTitle(input: string, maxLength: number = DEFAULT_MAX_TITLE_LENGTH): string | undefined {
	const raw = input.trim();
	if (!raw) return undefined;
	if (raw.startsWith("/") || raw.startsWith("!")) return undefined;

	const cleaned = stripMarkdownNoise(raw);
	const primaryLine = firstMeaningfulLine(cleaned) || cleaned;
	const flattened = collapseWhitespace(stripListPrefix(primaryLine));
	if (!flattened) return undefined;

	const sentence = stripWrappingPunctuation(takeFirstSentence(flattened));
	const candidate = sentence.length >= 3 ? sentence : stripWrappingPunctuation(flattened);
	const title = truncateTitle(candidate, maxLength).trim();
	return title || undefined;
}
