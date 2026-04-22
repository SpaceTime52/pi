import type { ExtensionContext, Theme } from "@mariozechner/pi-coding-agent";
import { truncateToWidth } from "@mariozechner/pi-tui";
import * as path from "node:path";

export function getProjectName(ctx: ExtensionContext) {
	return path.basename(ctx.cwd) || ctx.cwd;
}

export function createClaudeHeader(ctx: ExtensionContext) {
	const projectName = getProjectName(ctx);
	return (_tui: unknown, theme: Theme) => ({
		invalidate() {},
		render(width: number) {
			const line1 = `${theme.fg("accent", "✻")} ${theme.fg("text", theme.bold("pi"))}${theme.fg("dim", "  claude-code ui")}`;
			const line2 = `${theme.fg("muted", projectName)}${theme.fg("dim", "  ·  claude-code-dark")}`;
			return ["", truncateToWidth(line1, width, ""), truncateToWidth(line2, width, ""), ""];
		},
	});
}
