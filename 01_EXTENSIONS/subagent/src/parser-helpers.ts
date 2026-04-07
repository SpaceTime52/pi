import { previewText } from "./format.js";
import type { AssistantMessage, AssistantMessageEvent, ParsedEvent } from "./parser-types.js";
import { isRunTree } from "./run-tree.js";
import type { NestedRunSnapshot } from "./types.js";

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

export function parseUsage(message: AssistantMessage | undefined) {
	if (!message?.usage) return undefined;
	return {
		inputTokens: message.usage.inputTokens ?? 0,
		outputTokens: message.usage.outputTokens ?? 0,
		turns: 1,
	};
}

export function extractAssistantText(message: AssistantMessage | undefined): string {
	if (!message || message.role !== "assistant") return "";
	return message.content?.filter((c) => c.type === "text").map((c) => c.text).join("\n") ?? "";
}

function extractToolText(result: unknown): string {
	if (!result || typeof result !== "object") return typeof result === "string" ? result : "";
	if (!("content" in result) || !Array.isArray(result.content)) return "";
	return result.content
		.filter((c): c is { type?: string; text?: string } => typeof c === "object" && c !== null)
		.filter((c) => c.type === "text" && typeof c.text === "string")
		.map((c) => c.text)
		.join("\n");
}

function isNestedRunSnapshot(value: unknown): value is NestedRunSnapshot {
	if (!isRecord(value)) return false;
	return typeof value.id === "number"
		&& typeof value.agent === "string"
		&& typeof value.startedAt === "number"
		&& typeof value.depth === "number"
		&& (value.task === undefined || typeof value.task === "string")
		&& (value.activity === undefined || typeof value.activity === "string")
		&& (value.lastEventAt === undefined || typeof value.lastEventAt === "number");
}

function extractNestedRuns(result: unknown): NestedRunSnapshot[] | undefined {
	if (!isRecord(result) || !isRecord(result.details) || !Array.isArray(result.details.activeRuns)) return undefined;
	const runs = result.details.activeRuns.filter(isNestedRunSnapshot);
	return runs.length === result.details.activeRuns.length ? runs : undefined;
}

function extractRunTrees(result: unknown) {
	if (!isRecord(result) || !isRecord(result.details) || !Array.isArray(result.details.runTrees)) return undefined;
	const trees = result.details.runTrees.filter(isRunTree);
	return trees.length === result.details.runTrees.length ? trees : undefined;
}

export function summarizeArgs(args: unknown): string {
	if (!isRecord(args)) return typeof args === "string" ? previewText(args, 80) : "";
	const obj = args;
	for (const key of ["command", "path", "query", "tool", "server", "url", "text"]) {
		if (typeof obj[key] === "string" && obj[key]) return previewText(obj[key], 80);
	}
	return previewText(JSON.stringify(args), 80);
}

export function parseAssistantUpdate(message: AssistantMessage | undefined, delta: AssistantMessageEvent | undefined): ParsedEvent | null {
	if (message?.role !== "assistant" || !delta?.type) return null;
	if (delta.type === "text_delta" && delta.delta) return { type: "message_delta", text: delta.delta };
	if (delta.type === "done") return { type: "agent_end", stopReason: delta.reason ?? message.stopReason };
	if (delta.type !== "error") return null;
	const err = typeof delta.error === "string" ? delta.error : delta.error?.message;
	return { type: "agent_end", stopReason: delta.reason ?? "error", text: err, isError: true };
}

export function parseToolEvent(type: "tool_start" | "tool_update" | "tool_end", toolName: string | undefined, data: unknown, isError?: boolean): ParsedEvent {
	const text = previewText(extractToolText(data), 120);
	if (type === "tool_start") return { type, toolName, text: summarizeArgs(data) };
	const nestedRuns = extractNestedRuns(data);
	const runTrees = type === "tool_end" ? extractRunTrees(data) : undefined;
	const nested = nestedRuns ? { nestedRuns } : {};
	const completed = runTrees ? { runTrees } : {};
	return type === "tool_end"
		? { type, toolName, text, isError: !!isError, ...nested, ...completed }
		: { type, toolName, text, ...nested };
}
