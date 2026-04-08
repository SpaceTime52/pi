import type { TSchema } from "@sinclair/typebox";
import { AbortToolParams, BatchToolParams, ChainToolParams, ContinueToolParams, DetailToolParams, RunToolParams, RunsToolParams } from "./params.js";
import { subagentToolName } from "./tool-names.js";
import type { AgentTaskInput, Subcommand } from "./types.js";

export interface ToolSpec {
	name: string;
	label: string;
	description: string;
	parameters: TSchema;
	buildSubcommand: (params: unknown) => Subcommand;
}

const str = (value: unknown, key: string) => String(Reflect.get(Object(value), key) ?? "");
const num = (value: unknown, key: string) => Number(Reflect.get(Object(value), key));
const bool = (value: unknown, key: string) => Boolean(Reflect.get(Object(value), key));
const tasks = (value: unknown, key: "items" | "steps"): AgentTaskInput[] => {
	const list = Reflect.get(Object(value), key);
	return Array.isArray(list) ? list.map((item) => ({ agent: str(item, "agent"), task: str(item, "task") })) : [];
};

export const subagentToolSpecs: ToolSpec[] = [
	{ name: subagentToolName("run"), label: "Subagent Run", description: "Run a single isolated subagent", parameters: RunToolParams, buildSubcommand: (params) => ({ type: "run", agent: str(params, "agent"), task: str(params, "task"), main: bool(params, "main"), cwd: str(params, "cwd") || undefined }) },
	{ name: subagentToolName("batch"), label: "Subagent Batch", description: "Run multiple isolated subagents in parallel", parameters: BatchToolParams, buildSubcommand: (params) => ({ type: "batch", items: tasks(params, "items"), main: bool(params, "main") }) },
	{ name: subagentToolName("chain"), label: "Subagent Chain", description: "Run isolated subagents sequentially with previous output piping", parameters: ChainToolParams, buildSubcommand: (params) => ({ type: "chain", steps: tasks(params, "steps"), main: bool(params, "main") }) },
	{ name: subagentToolName("continue"), label: "Subagent Continue", description: "Continue an existing subagent session", parameters: ContinueToolParams, buildSubcommand: (params) => ({ type: "continue", id: num(params, "id"), task: str(params, "task") }) },
	{ name: subagentToolName("abort"), label: "Subagent Abort", description: "Abort an active subagent run", parameters: AbortToolParams, buildSubcommand: (params) => ({ type: "abort", id: num(params, "id") }) },
	{ name: subagentToolName("detail"), label: "Subagent Detail", description: "Show detailed history for a subagent run", parameters: DetailToolParams, buildSubcommand: (params) => ({ type: "detail", id: num(params, "id") }) },
	{ name: subagentToolName("runs"), label: "Subagent Runs", description: "List active and historical subagent runs", parameters: RunsToolParams, buildSubcommand: () => ({ type: "runs" }) },
];
