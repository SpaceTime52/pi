import { defineTool, createBashToolDefinition, type AgentToolResult, type BashToolDetails, type BashToolInput, type Theme } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { summarizeTextPreview, toolPrefix } from "./tool-utils.js";

type BashResult = AgentToolResult<BashToolDetails | undefined>;
type RenderOptions = { expanded: boolean; isPartial: boolean };

export function createClaudeBashTool(cwd: string) {
	const base = createBashToolDefinition(cwd);
	return defineTool({
		...base,
		renderCall(args: BashToolInput, theme: Theme) {
			const command = args.command.length > 88 ? `${args.command.slice(0, 85)}…` : args.command;
			return new Text(`${toolPrefix(theme, "Bash")} ${theme.fg("muted", command)}`, 0, 0);
		},
		renderResult(result: BashResult, { expanded, isPartial }: RenderOptions, theme: Theme) {
			if (isPartial) return new Text(theme.fg("warning", "running…"), 0, 0);
			const first = result.content[0];
			const output = first?.type === "text" ? first.text : "";
			const exitCode = output.match(/exit code: (\d+)/)?.[1];
			let text = exitCode && exitCode !== "0" ? theme.fg("error", `exit ${exitCode}`) : theme.fg("success", "done");
			text += theme.fg("dim", ` · ${output.split("\n").filter((line) => line.trim()).length} lines`);
			if (result.details?.truncation?.truncated) text += theme.fg("dim", " · truncated");
			if (expanded && output.trim()) text += `\n${summarizeTextPreview(theme, output, 18)}`;
			return new Text(text, 0, 0);
		},
	});
}
