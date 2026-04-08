import type { Subcommand } from "./types.js";

export const SUBAGENT_TOOL_PREFIX = "subagent_";
const suffixes = ["run", "batch", "chain", "continue", "abort", "detail", "runs"] as const;
export type SubagentToolKind = typeof suffixes[number];

export const subagentToolKinds = [...suffixes];
export const subagentToolName = (kind: SubagentToolKind) => `${SUBAGENT_TOOL_PREFIX}${kind}`;

export function isSubagentToolName(name: string | undefined): boolean {
	return typeof name === "string" && (name === "subagent" || suffixes.some((suffix) => name === subagentToolName(suffix)));
}

export function subcommandTypeFromToolName(name: string): Subcommand["type"] | undefined {
	return suffixes.find((suffix) => name === subagentToolName(suffix));
}
