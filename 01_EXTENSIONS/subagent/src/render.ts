import type { RunResult } from "./types.js";
import { formatUsage } from "./format.js";
import { parseCommand } from "./cli.js";

export function buildCallText(params: { command: string }): string {
	try {
		const cmd = parseCommand(params.command);
		if (cmd.type === "run") return `▶ subagent run ${cmd.agent} -- ${cmd.task}`;
		if (cmd.type === "batch") return `▶ subagent batch (${cmd.items.length} tasks)`;
		if (cmd.type === "chain") return `▶ subagent chain (${cmd.steps.length} steps)`;
		if (cmd.type === "continue") return `▶ subagent continue #${cmd.id} -- ${cmd.task}`;
		if (cmd.type === "abort") return `▶ subagent abort #${cmd.id}`;
		if (cmd.type === "detail") return `▶ subagent detail #${cmd.id}`;
		return `▶ subagent ${params.command}`;
	} catch { return `▶ subagent ${params.command}`; }
}

export function buildResultText(result: RunResult): string {
	const header = `${result.agent} #${result.id}`;
	if (result.error) return `✗ ${header} error: ${result.error}`;
	if (result.escalation) return `⚠ ${header} needs your input:\n${result.escalation}\n\nUse: subagent continue ${result.id} -- <your answer>`;
	return `✓ ${header}\n${result.output}\n\n${formatUsage(result.usage)}`;
}

function textComponent(text: string) {
	const lines = text.split("\n");
	return { render(width: number) { return lines.map((l) => l.slice(0, width)); } };
}

export function renderCall(args: { command: string }) {
	return textComponent(buildCallText(args));
}

export function renderResult(result: { content: Array<{ type: string; text: string }>; details?: { isError?: boolean } }) {
	const text = result.content.map((c) => c.text).join("\n");
	return textComponent(text);
}
