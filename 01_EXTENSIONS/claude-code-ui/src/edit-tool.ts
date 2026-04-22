import { defineTool, createEditToolDefinition, type AgentToolResult, type EditToolDetails, type EditToolInput, type Theme } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { indentBlock, toolPrefix, toolResult } from "./tool-utils.js";

type EditResult = AgentToolResult<EditToolDetails | undefined>;
type RenderOptions = { expanded: boolean; isPartial: boolean };

export function renderDiffLine(theme: Theme, line: string) {
	if (line.startsWith("+") && !line.startsWith("+++")) return theme.fg("toolDiffAdded", line);
	if (line.startsWith("-") && !line.startsWith("---")) return theme.fg("toolDiffRemoved", line);
	return theme.fg("toolDiffContext", line);
}

export function createClaudeEditTool(cwd: string) {
	const base = createEditToolDefinition(cwd);
	return defineTool({
		...base,
		renderShell: "self",
		renderCall(args: EditToolInput, theme: Theme) {
			return new Text(`${toolPrefix(theme, "Edit")} ${theme.fg("muted", args.path)}`, 0, 0);
		},
		renderResult(result: EditResult, { expanded, isPartial }: RenderOptions, theme: Theme) {
			if (isPartial) return new Text(toolResult(theme, theme.fg("warning", "editing…")), 0, 0);
			const content = result.content[0];
			if (content?.type === "text" && content.text.startsWith("Error")) return new Text(toolResult(theme, theme.fg("error", content.text.split("\n")[0])), 0, 0);
			if (!result.details?.diff) return new Text(toolResult(theme, theme.fg("success", "applied")), 0, 0);
			const diffLines = result.details.diff.split("\n");
			const additions = diffLines.filter((line) => line.startsWith("+") && !line.startsWith("+++")).length;
			const removals = diffLines.filter((line) => line.startsWith("-") && !line.startsWith("---")).length;
			const summary = `${theme.fg("success", `+${additions}`)}${theme.fg("dim", " · ")}${theme.fg("error", `-${removals}`)}`;
			if (!expanded) return new Text(toolResult(theme, summary), 0, 0);
			const preview = diffLines.slice(0, 24).map((line) => renderDiffLine(theme, line));
			if (diffLines.length > 24) preview.push(theme.fg("dim", `… ${diffLines.length - 24} more diff lines`));
			return new Text(`${toolResult(theme, summary)}\n${indentBlock(preview.join("\n"))}`, 0, 0);
		},
	});
}
