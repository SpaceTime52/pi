import { truncateToWidth } from "@mariozechner/pi-tui";
import type { RunResult, SubagentToolInput } from "./types.js";
import { formatUsage, previewText } from "./format.js";
import { normalizeInput, stringifyCommand } from "./cli.js";
import { formatRunTrees } from "./run-tree.js";

export function buildCallText(params: SubagentToolInput): string {
	try {
		const cmd = normalizeInput(params);
		if (cmd.type === "run") return `▶ subagent run ${cmd.agent} -- ${cmd.task}`;
		if (cmd.type === "batch") return `▶ subagent batch (${cmd.items.length} tasks)`;
		if (cmd.type === "chain") return `▶ subagent chain (${cmd.steps.length} steps)`;
		if (cmd.type === "continue") return `▶ subagent continue #${cmd.id} -- ${cmd.task}`;
		if (cmd.type === "abort") return `▶ subagent abort #${cmd.id}`;
		if (cmd.type === "detail") return `▶ subagent detail #${cmd.id}`;
		return `▶ subagent ${stringifyCommand(cmd)}`;
	} catch {
		return `▶ subagent ${JSON.stringify(params)}`;
	}
}

export function buildResultText(result: RunResult): string {
	const header = `${result.agent} #${result.id}${result.task ? ` — ${previewText(result.task, 72)}` : ""}`;
	const footer = `${formatUsage(result.usage)}${result.stopReason ? ` / stop: ${result.stopReason}` : ""}`;
	const tree = formatRunTrees(result.runTrees);
	const treeSection = tree.length > 0 ? `\n\nnested runs:\n${tree.join("\n")}` : "";
	if (result.error) {
		return `✗ ${header}\nerror: ${result.error}${result.output ? `\n\n${result.output}` : ""}${treeSection}\n\n${footer}`;
	}
	if (result.escalation) return `⚠ ${header} needs your input:\n${result.escalation}${treeSection}\n\nUse: subagent continue ${result.id} -- <your answer>`;
	return `✓ ${header}\n${result.output || "(no output)"}${treeSection}\n\n${footer}`;
}

function textComponent(text: string) {
	const lines = text.split("\n");
	return {
		render(width: number) {
			const safeWidth = Math.max(0, width);
			return lines.map((line) => truncateToWidth(line, safeWidth));
		},
		invalidate() {},
	};
}

export function renderCall(args: SubagentToolInput) {
	return textComponent(buildCallText(args));
}

export function renderResult(result: { content: Array<{ type: string; text?: string }>; details?: { isError?: boolean } }) {
	const text = result.content
		.filter((c) => c.type === "text" && typeof c.text === "string")
		.map((c) => c.text)
		.join("\n");
	return textComponent(text);
}
