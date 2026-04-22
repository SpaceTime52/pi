import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { ClaudeCodeEditor } from "./editor.js";
import { createClaudeFooter } from "./footer.js";
import { createClaudeHeader, getProjectName } from "./header.js";
import { WORKING_INDICATOR } from "./indicator.js";
import { applyClaudeTheme } from "./theme.js";

export function applyClaudeChrome(ctx: ExtensionContext) {
	const themeResult = applyClaudeTheme(ctx);
	ctx.ui.setHeader(createClaudeHeader(ctx));
	ctx.ui.setFooter(createClaudeFooter(ctx));
	ctx.ui.setEditorComponent((tui, theme, keybindings) =>
		new ClaudeCodeEditor(
			tui,
			theme,
			keybindings,
			(text) => ctx.ui.theme.fg("accent", ctx.ui.theme.bold(text)),
			(text) => ctx.ui.theme.fg("dim", text),
		),
	);
	ctx.ui.setWorkingIndicator(WORKING_INDICATOR);
	ctx.ui.setHiddenThinkingLabel("thinking");
	ctx.ui.setTitle(`pi · ${getProjectName(ctx)}`);
	if (!themeResult.success) {
		ctx.ui.notify(
			`Claude UI applied, but theme switch failed: ${themeResult.error ?? "unknown error"}`,
			"warning",
		);
	}
}
