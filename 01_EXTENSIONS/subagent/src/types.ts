export interface AgentConfig {
	name: string;
	description: string;
	model?: string;
	thinking?: string;
	tools?: string[];
	systemPrompt: string;
	filePath: string;
}

export type RunStatus = "ok" | "error" | "escalation";
export interface RunTree { id: number; agent: string; task?: string; status: RunStatus; stopReason?: string; error?: string; outputPreview?: string; children?: RunTree[] }
export interface UsageStats { inputTokens: number; outputTokens: number; turns: number }
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

export interface NestedRunSnapshot { id: number; agent: string; task?: string; startedAt: number; depth: number; activity?: string; lastEventAt?: number }
export interface SubagentToolDetails { isError: boolean; activeRuns?: NestedRunSnapshot[]; runTrees?: RunTree[] }
export interface ActiveRun { id: number; agent: string; task?: string; startedAt: number; abort: () => void }
export interface SubagentPi { appendEntry(type: string, data?: unknown): void }
export interface AgentTaskInput { agent: string; task: string }

export interface RunToolInput { agent: string; task: string; main?: boolean; cwd?: string }
export interface BatchToolInput { items: AgentTaskInput[]; main?: boolean }
export interface ChainToolInput { steps: AgentTaskInput[]; main?: boolean }
export interface ContinueToolInput { id: number; task: string }
export interface AbortToolInput { id: number }
export interface DetailToolInput { id: number }
export interface RunsToolInput {}

export type Subcommand =
	| { type: "run"; agent: string; task: string; main: boolean; cwd?: string }
	| { type: "batch"; items: AgentTaskInput[]; main: boolean }
	| { type: "chain"; steps: AgentTaskInput[]; main: boolean }
	| { type: "continue"; id: number; task: string }
	| { type: "abort"; id: number }
	| { type: "detail"; id: number }
	| { type: "runs" };
