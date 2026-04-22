import type { Theme } from "@mariozechner/pi-coding-agent";

export function toolPrefix(theme: Theme, label: string) {
	return `${theme.fg("accent", "●")} ${theme.fg("toolTitle", theme.bold(label))}`;
}

export function summarizeTextPreview(theme: Theme, text: string, maxLines: number) {
	const lines = text.split("\n");
	const preview = lines.slice(0, maxLines).map((line) => theme.fg("toolOutput", line));
	if (lines.length > maxLines) preview.push(theme.fg("dim", `… ${lines.length - maxLines} more lines`));
	return preview.join("\n");
}
