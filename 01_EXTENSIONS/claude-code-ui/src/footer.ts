import type { AssistantMessage } from "@mariozechner/pi-ai";
import type { ExtensionContext, Theme } from "@mariozechner/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import { getProjectName } from "./header.js";

function formatCompactNumber(value: number) {
	if (value < 1000) return `${value}`;
	if (value < 10000) return `${(value / 1000).toFixed(1)}k`;
	return `${Math.round(value / 1000)}k`;
}

function getUsageTotals(ctx: ExtensionContext) {
	let inputTokens = 0;
	let outputTokens = 0;
	let totalCost = 0;
	for (const entry of ctx.sessionManager.getBranch()) {
		if (entry.type !== "message" || entry.message.role !== "assistant") continue;
		const message = entry.message as AssistantMessage;
		inputTokens += message.usage.input;
		outputTokens += message.usage.output;
		totalCost += message.usage.cost.total;
	}
	return { inputTokens, outputTokens, totalCost };
}

export function createClaudeFooter(ctx: ExtensionContext) {
	const projectName = getProjectName(ctx);
	return (tui: { requestRender(): void }, theme: Theme, footerData: {
		onBranchChange(fn: () => void): () => void;
		getGitBranch(): string | null;
	}) => ({
		dispose: footerData.onBranchChange(() => tui.requestRender()),
		invalidate() {},
		render(width: number) {
			const totals = getUsageTotals(ctx);
			const branch = footerData.getGitBranch();
			const usage = ctx.getContextUsage();
			const contextText = usage?.percent == null ? "ctx --" : `ctx ${Math.round(usage.percent)}%`;
			let left = `${theme.fg("accent", "✻")} ${theme.fg("text", projectName)}`;
			if (branch) left += theme.fg("dim", ` · ${branch}`);
			const rightParts = [
				theme.fg("muted", ctx.model?.id ?? "no-model"),
				theme.fg("dim", contextText),
				theme.fg("dim", `↑${formatCompactNumber(totals.inputTokens)} ↓${formatCompactNumber(totals.outputTokens)}`),
				theme.fg("dim", `$${totals.totalCost.toFixed(3)}`),
			];
			const right = rightParts.join(theme.fg("dim", " · "));
			const gap = Math.max(1, width - visibleWidth(left) - visibleWidth(right));
			return [truncateToWidth(left + " ".repeat(gap) + right, width, "")];
		},
	});
}
