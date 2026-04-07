import { Type } from "@sinclair/typebox";

export const SubagentParams = Type.Object({
	command: Type.String({ description: "Subcommand string (e.g. 'run scout -- find auth code')" }),
});

export interface AgentConfig {
	name: string;
	description: string;
	model?: string;
	/** Reasoning level passed as --thinking to pi CLI. Valid: off, minimal, low, medium, high, xhigh */
	thinking?: string;
	/** Comma-separated in frontmatter. Available pi tools: read, bash, edit, write, grep, find, ls */
	tools?: string[];
	systemPrompt: string;
	filePath: string;
}

export type RunStatus = "ok" | "error" | "escalation";

export interface RunTree {
	id: number;
	agent: string;
	task?: string;
	status: RunStatus;
	stopReason?: string;
	error?: string;
	outputPreview?: string;
	children?: RunTree[];
}

export interface RunResult {
	id: number;
	agent: string;
	output: string;
	usage: UsageStats;
	task?: string;
	escalation?: string;
	error?: string;
	stopReason?: string;
	runTrees?: RunTree[];
}

export interface NestedRunSnapshot {
	id: number;
	agent: string;
	task?: string;
	startedAt: number;
	depth: number;
	activity?: string;
	lastEventAt?: number;
}

export interface SubagentToolDetails {
	isError: boolean;
	activeRuns?: NestedRunSnapshot[];
	runTrees?: RunTree[];
}

export interface UsageStats {
	inputTokens: number;
	outputTokens: number;
	turns: number;
}

export interface ActiveRun {
	id: number;
	agent: string;
	task?: string;
	startedAt: number;
	abort: () => void;
}

export interface SubagentPi {
	appendEntry(type: string, data?: unknown): void;
}

export type Subcommand =
	| { type: "run"; agent: string; task: string; main: boolean; cwd?: string }
	| { type: "batch"; items: Array<{ agent: string; task: string }>; main: boolean }
	| { type: "chain"; steps: Array<{ agent: string; task: string }>; main: boolean }
	| { type: "continue"; id: number; task: string }
	| { type: "abort"; id: number }
	| { type: "detail"; id: number }
	| { type: "runs" };
