import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import { stripAnsi } from "./ansi.js";

export function buildChromeRule(
	width: number,
	label: string,
	borderColor: (text: string) => string,
) {
	const prefix = borderColor("──");
	const labelPart = ` ${label} `;
	const suffixWidth = Math.max(0, width - visibleWidth(prefix) - visibleWidth(labelPart));
	const suffix = borderColor("─".repeat(suffixWidth));
	return truncateToWidth(prefix + labelPart + suffix, width, "");
}

export function findBottomRuleIndex(lines: string[]) {
	for (let i = lines.length - 1; i >= 0; i--) {
		const raw = stripAnsi(lines[i]!);
		if (/^─+$/.test(raw) || /^─── ↓ \d+ more /.test(raw)) return i;
	}
	return -1;
}
