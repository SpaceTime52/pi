import type { AgentToolResult, AgentToolUpdateCallback } from "@mariozechner/pi-coding-agent";
import { listRuns } from "./store.js";
import type { NestedRunSnapshot, SubagentToolDetails } from "./types.js";

type Update = AgentToolResult<SubagentToolDetails>;
type ActiveUpdate = Update & { details: SubagentToolDetails & { activeRuns: NestedRunSnapshot[] } };
type UpdateFn = AgentToolUpdateCallback<SubagentToolDetails> | undefined;

export function createBatchUpdate(onUpdate: UpdateFn, total: number): UpdateFn {
	if (!onUpdate) return undefined;
	const active = new Map<number, ActiveUpdate>();
	const finished = new Map<number, ActiveUpdate>();
	return (update) => {
		if (!hasRootRun(update)) return onUpdate(update);
		active.set(update.details.activeRuns[0].id, update);
		const activeIds = new Set(listRuns().map((run) => run.id));
		for (const [id, entry] of active) if (!activeIds.has(id)) active.delete(id), finished.set(id, entry);
		onUpdate(aggregate(Array.from(active.entries()), Array.from(finished.entries()), total));
	};
}

function aggregate(active: Array<[number, ActiveUpdate]>, finished: Array<[number, ActiveUpdate]>, total: number): Update {
	const activeSorted = active.sort(([a], [b]) => a - b).map(([, update]) => update);
	const finishedSorted = finished.sort(([a], [b]) => a - b).map(([, update]) => update);
	const blocks = [
		`⏳ batch progress — ${activeSorted.length} active / ${finishedSorted.length} finished / ${total} total`,
		...activeSection(activeSorted),
		...finishedSection(finishedSorted),
	].filter(Boolean);
	return { content: [{ type: "text", text: blocks.join("\n\n") }], details: { isError: false, activeRuns: mergeRuns(activeSorted) } };
}

function hasRootRun(update: Update): update is ActiveUpdate {
	const root = update.details?.activeRuns?.[0];
	return typeof root?.id === "number";
}

function text(update: Update): string {
	const item = update.content.find((content) => content.type === "text");
	return item?.type === "text" ? item.text : "";
}

function activeSection(active: ActiveUpdate[]): string[] {
	if (active.length === 0) return [];
	return ["active:", ...active.map((update) => indent(text(update)))];
}

function finishedSection(finished: ActiveUpdate[]): string[] {
	if (finished.length === 0) return [];
	return ["finished:", ...finished.slice(-8).map((update) => `  ${summary(text(update))}`)];
}

function indent(text: string): string {
	return text.split("\n").map((line) => `  ${line}`).join("\n");
}

function summary(value: string): string {
	const [header = "subagent", current = ""] = value.split("\n");
	const prefix = current.includes("failed") || value.includes("\n  ✗ ") ? "✗" : "✓";
	return `${prefix} ${header.replace(/^⏳\s+/, "")}`;
}

function mergeRuns(updates: ActiveUpdate[]): NestedRunSnapshot[] {
	const merged = new Map<number, NestedRunSnapshot>();
	for (const update of updates) for (const run of update.details.activeRuns) merged.set(run.id, run);
	return Array.from(merged.values()).sort((a, b) => a.depth - b.depth || a.id - b.id);
}
