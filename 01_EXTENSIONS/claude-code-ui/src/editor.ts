import { CustomEditor, type KeybindingsManager } from "@mariozechner/pi-coding-agent";
import type { EditorTheme, TUI } from "@mariozechner/pi-tui";
import { stripAnsi } from "./ansi.js";
import { buildChromeRule, findBottomRuleIndex } from "./rules.js";

export class ClaudeCodeEditor extends CustomEditor {
	constructor(
		tui: TUI,
		theme: EditorTheme,
		keybindings: KeybindingsManager,
		private readonly label: (text: string) => string,
		private readonly hint: (text: string) => string,
	) {
		super(tui, theme, keybindings, { paddingX: 1 });
	}

	override render(width: number) {
		const lines = super.render(width);
		if (lines.length === 0) return lines;
		lines[0] = this.decorateTopBorder(lines[0]!, width);
		const bottomIndex = findBottomRuleIndex(lines);
		if (bottomIndex >= 0) lines[bottomIndex] = this.decorateBottomBorder(lines[bottomIndex]!, width);
		return lines;
	}

	private decorateTopBorder(existing: string, width: number) {
		if (!/^─+$/.test(stripAnsi(existing))) return existing;
		return buildChromeRule(width, this.label("prompt"), this.borderColor);
	}

	private decorateBottomBorder(existing: string, width: number) {
		if (!/^─+$/.test(stripAnsi(existing))) return existing;
		const label = this.label("enter send") + this.hint("  ·  shift+enter newline");
		return buildChromeRule(width, label, this.borderColor);
	}
}
