import { previewText } from "./format.js";
import type { RunResult, RunStatus, RunTree } from "./types.js";

export function statusForResult(result: Pick<RunResult, "error" | "escalation">): RunStatus {
	if (result.error) return "error";
	if (result.escalation) return "escalation";
	return "ok";
}

export function resultToRunTree(result: RunResult): RunTree {
	return {
		id: result.id,
		agent: result.agent,
		task: result.task,
		status: statusForResult(result),
		stopReason: result.stopReason,
		error: result.error,
		outputPreview: previewText(result.escalation ?? result.output, 120),
		children: result.runTrees?.map((child) => ({ ...child })),
	};
}

function treeIcon(status: RunStatus): string {
	if (status === "error") return "✗";
	if (status === "escalation") return "⚠";
	return "✓";
}

function treeSuffix(tree: RunTree): string {
	if (tree.status === "error" && tree.error) return ` — ${previewText(tree.error, 80)}`;
	if (tree.status === "escalation" && tree.outputPreview) return ` — ${previewText(tree.outputPreview, 80)}`;
	if (tree.stopReason) return ` (${tree.stopReason})`;
	return "";
}

function formatTreeLabel(tree: RunTree): string {
	const task = tree.task ? ` — ${previewText(tree.task, 60)}` : "";
	return `${treeIcon(tree.status)} ${tree.agent} #${tree.id}${task}${treeSuffix(tree)}`;
}

function formatRunTree(tree: RunTree, prefix: string, isLast: boolean): string[] {
	const branch = `${prefix}${isLast ? "└─" : "├─"}`;
	const childPrefix = `${prefix}${isLast ? "  " : "│ "}`;
	const children = tree.children ?? [];
	const lines = [`${branch}${formatTreeLabel(tree)}`];
	for (const [index, child] of children.entries()) {
		lines.push(...formatRunTree(child, childPrefix, index === children.length - 1));
	}
	return lines;
}

export function formatRunTrees(trees: RunTree[] | undefined): string[] {
	if (!trees || trees.length === 0) return [];
	return trees.flatMap((tree, index) => formatRunTree(tree, "", index === trees.length - 1));
}

export function isRunTree(value: unknown): value is RunTree {
	if (typeof value !== "object" || value === null) return false;
	const tree = value as Record<string, unknown>;
	if (typeof tree.id !== "number" || typeof tree.agent !== "string") return false;
	if (tree.task !== undefined && typeof tree.task !== "string") return false;
	if (tree.status !== "ok" && tree.status !== "error" && tree.status !== "escalation") return false;
	if (tree.stopReason !== undefined && typeof tree.stopReason !== "string") return false;
	if (tree.error !== undefined && typeof tree.error !== "string") return false;
	if (tree.outputPreview !== undefined && typeof tree.outputPreview !== "string") return false;
	if (tree.children !== undefined) {
		if (!Array.isArray(tree.children)) return false;
		if (!tree.children.every(isRunTree)) return false;
	}
	return true;
}
