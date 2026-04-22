export function truncateText(text: string, maxLines = 400, maxChars = 60000): string {
	const clippedChars = text.length > maxChars ? `${text.slice(0, maxChars)}\n\n[truncated by characters]` : text;
	const lines = clippedChars.split(/\r?\n/u);
	if (lines.length <= maxLines) return clippedChars;
	return `${lines.slice(0, maxLines).join("\n")}\n\n[truncated by lines]`;
}
