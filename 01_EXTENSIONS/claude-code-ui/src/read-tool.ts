import { defineTool, createReadToolDefinition, type AgentToolResult, type ReadToolDetails, type ReadToolInput, type Theme } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { summarizeTextPreview, toolPrefix } from "./tool-utils.js";

type ReadResult = AgentToolResult<ReadToolDetails | undefined>;
type RenderOptions = { expanded: boolean; isPartial: boolean };

export function createClaudeReadTool(cwd: string) {
	const base = createReadToolDefinition(cwd);
	return defineTool({
		...base,
		renderCall(args: ReadToolInput, theme: Theme) {
			return new Text(`${toolPrefix(theme, "Read")} ${theme.fg("muted", args.path)}`, 0, 0);
		},
		renderResult(result: ReadResult, { expanded, isPartial }: RenderOptions, theme: Theme) {
			if (isPartial) return new Text(theme.fg("warning", "reading…"), 0, 0);
			const content = result.content[0];
			if (content?.type !== "text") return new Text(theme.fg("success", "loaded"), 0, 0);
			let text = theme.fg("success", `${content.text.split("\n").length} lines`);
			if (result.details?.truncation?.truncated) text += theme.fg("dim", ` · truncated from ${result.details.truncation.totalLines}`);
			if (expanded) text += `\n${summarizeTextPreview(theme, content.text, 14)}`;
			return new Text(text, 0, 0);
		},
	});
}
