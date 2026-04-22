import { defineTool, createWriteToolDefinition, type AgentToolResult, type Theme, type WriteToolInput } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { toolPrefix, toolResult } from "./tool-utils.js";

type WriteResult = AgentToolResult<undefined>;
type RenderOptions = { isPartial: boolean };

export function createClaudeWriteTool(cwd: string) {
	const base = createWriteToolDefinition(cwd);
	return defineTool({
		...base,
		renderShell: "self",
		renderCall(args: WriteToolInput, theme: Theme) {
			const suffix = theme.fg("dim", ` · ${args.content.split("\n").length} lines`);
			return new Text(`${toolPrefix(theme, "Write")} ${theme.fg("muted", args.path)}${suffix}`, 0, 0);
		},
		renderResult(result: WriteResult, { isPartial }: RenderOptions, theme: Theme) {
			if (isPartial) return new Text(toolResult(theme, theme.fg("warning", "writing…")), 0, 0);
			const content = result.content[0];
			if (content?.type === "text" && content.text.startsWith("Error")) return new Text(toolResult(theme, theme.fg("error", content.text.split("\n")[0])), 0, 0);
			return new Text(toolResult(theme, theme.fg("success", "written")), 0, 0);
		},
	});
}
