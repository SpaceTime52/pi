import { truncateToWidth } from "@mariozechner/pi-tui";
import type { RunResult, Subcommand } from "./types.js";
import { formatUsage, previewText } from "./format.js";
import { stringifyCommand } from "./cli.js";
import { formatRunTrees } from "./run-tree.js";

export function buildCallText(cmd: Subcommand): string {
	if (cmd.type === "run") return `▶ subagent run ${cmd.agent} -- ${cmd.task}`;
	if (cmd.type === "batch") return `▶ subagent batch (${cmd.items.length} tasks)`;
	if (cmd.type === "chain") return `▶ subagent chain (${cmd.steps.length} steps)`;
	if (cmd.type === "continue") return `▶ subagent continue #${cmd.id} -- ${cmd.task}`;
	if (cmd.type === "abort") return `▶ subagent abort #${cmd.id}`;
	if (cmd.type === "detail") return `▶ subagent detail #${cmd.id}`;
	return `▶ subagent ${stringifyCommand(cmd)}`;
}

export function buildResultText(result: RunResult): string {
	const header = `${result.agent} #${result.id}${result.task ? ` — ${previewText(result.task, 72)}` : ""}`;
	const footer = `${formatUsage(result.usage)}${result.stopReason ? ` / stop: ${result.stopReason}` : ""}`;
	const tree = formatRunTrees(result.runTrees);
	const treeSection = tree.length > 0 ? `\n\nnested runs:\n${tree.join("\n")}` : "";
	if (result.error) return `✗ ${header}\nerror: ${result.error}${result.output ? `\n\n${result.output}` : ""}${treeSection}\n\n${footer}`;
	if (result.escalation) return `⚠ ${header} needs your input:\n${result.escalation}${treeSection}\n\nUse: subagent continue ${result.id} -- <your answer>`;
	return `✓ ${header}\n${result.output || "(no output)"}${treeSection}\n\n${footer}`;
}

const textComponent = (text: string) => ({ render(width: number) { return text.split("\n").map((line) => truncateToWidth(line, Math.max(0, width))); }, invalidate() {} });
export const renderCallForCommand = (cmd: Subcommand) => textComponent(buildCallText(cmd));
export const renderCall = renderCallForCommand;
export function renderResult(result: { content: Array<{ type: string; text?: string }>; details?: unknown }) {
	return textComponent(result.content.filter((item) => item.type === "text" && typeof item.text === "string").map((item) => item.text).join("\n"));
}
