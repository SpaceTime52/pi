import { defineTool } from "@mariozechner/pi-coding-agent";
import type { AgentToolResult, AgentToolUpdateCallback, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { existsSync, readdirSync, readFileSync } from "fs";
import { dispatchAbort, dispatchBatch, dispatchChain, dispatchContinue, dispatchRun } from "./dispatch.js";
import type { DispatchCtx } from "./dispatch.js";
import { loadAgentsFromDir, getAgent } from "./agents.js";
import { createBatchUpdate } from "./batch-update.js";
import { buildResultText, renderCallForCommand, renderResult } from "./render.js";
import { resultToRunTree } from "./run-tree.js";
import { formatDetail, formatRunsList } from "./tool-report.js";
import { subagentToolSpecs } from "./tool-specs.js";
import type { AgentConfig, SubagentPi, SubagentToolDetails, Subcommand } from "./types.js";

const result = (text: string, isError = false, details?: Omit<SubagentToolDetails, "isError">): AgentToolResult<SubagentToolDetails> => ({ content: [{ type: "text", text }], details: { isError, ...details } });
export const errorMsg = (error: unknown) => error instanceof Error ? error.message : String(error);
type UpdateFn = AgentToolUpdateCallback<SubagentToolDetails> | undefined;

async function dispatch(cmd: Subcommand, agents: AgentConfig[], ctx: DispatchCtx, onUpdate: UpdateFn, signal?: AbortSignal) {
	if (cmd.type === "runs") return result(formatRunsList());
	if (cmd.type === "detail") return result(formatDetail(cmd.id));
	if (cmd.type === "abort") return result(dispatchAbort(cmd.id));
	if (cmd.type === "run") return runSingle(cmd, agents, ctx, onUpdate, signal);
	if (cmd.type === "batch") return runMany(cmd, agents, ctx, onUpdate, signal);
	if (cmd.type === "chain") return runChain(cmd, agents, ctx, onUpdate, signal);
	const continued = await dispatchContinue(cmd.id, cmd.task, agents, ctx, onUpdate, signal);
	return typeof continued === "string" ? result(continued, continued.includes("not found")) : result(buildResultText(continued), !!continued.error, { runTrees: [resultToRunTree(continued)] });
}

async function runSingle(cmd: Extract<Subcommand, { type: "run" }>, agents: AgentConfig[], ctx: DispatchCtx, onUpdate: UpdateFn, signal?: AbortSignal) {
	const agent = getAgent(cmd.agent, agents);
	if (!agent) return result(`Unknown agent: ${cmd.agent}`, true);
	const output = await dispatchRun(agent, cmd.task, ctx, cmd.main, onUpdate, signal);
	return result(buildResultText(output), !!output.error, { runTrees: [resultToRunTree(output)] });
}

async function runMany(cmd: Extract<Subcommand, { type: "batch" }>, agents: AgentConfig[], ctx: DispatchCtx, onUpdate: UpdateFn, signal?: AbortSignal) {
	const output = await dispatchBatch(cmd.items, agents, ctx, cmd.main, createBatchUpdate(onUpdate, cmd.items.length), signal);
	return result(output.map(buildResultText).join("\n---\n"), output.some((item) => !!item.error), { runTrees: output.map(resultToRunTree) });
}

async function runChain(cmd: Extract<Subcommand, { type: "chain" }>, agents: AgentConfig[], ctx: DispatchCtx, onUpdate: UpdateFn, signal?: AbortSignal) {
	const output = await dispatchChain(cmd.steps, agents, ctx, cmd.main, onUpdate, signal);
	return result(buildResultText(output), !!output.error, { runTrees: [resultToRunTree(output)] });
}

const snippet = (agents: AgentConfig[]) => `Dispatch subagents: ${agents.map((agent) => `${agent.name} (${agent.description})`).join(", ") || "none loaded"}`;
const guidelines = (agents: AgentConfig[]) => ["Available agents:", ...agents.map((agent) => `  - ${agent.name}: ${agent.description}`), "Use subagent_run / subagent_batch / subagent_chain / subagent_continue / subagent_abort / subagent_detail / subagent_runs as appropriate."];

function createNamedTool(spec: (typeof subagentToolSpecs)[number], pi: SubagentPi, agentsDir: string) {
	const agents = existsSync(agentsDir) ? loadAgentsFromDir(agentsDir, (dir) => readdirSync(dir).map(String), readFileSync as (path: string, encoding: string) => string) : [];
	return defineTool({
		name: spec.name, label: spec.label, description: spec.description, parameters: spec.parameters, promptSnippet: snippet(agents), promptGuidelines: guidelines(agents),
		async execute(_id: string, params: unknown, signal: AbortSignal | undefined, onUpdate: UpdateFn, ctx: ExtensionContext) { try { return await dispatch(spec.buildSubcommand(params), agents, ctx, onUpdate, signal); } catch (error) { return result(`Error: ${errorMsg(error)}`, true); } },
		renderCall: (args: unknown) => renderCallForCommand(spec.buildSubcommand(args)), renderResult: (res) => renderResult(res),
	});
}

export const createRunTool = (pi: SubagentPi, agentsDir: string) => createNamedTool(subagentToolSpecs[0], pi, agentsDir);
export const createBatchTool = (pi: SubagentPi, agentsDir: string) => createNamedTool(subagentToolSpecs[1], pi, agentsDir);
export const createChainTool = (pi: SubagentPi, agentsDir: string) => createNamedTool(subagentToolSpecs[2], pi, agentsDir);
export const createContinueTool = (pi: SubagentPi, agentsDir: string) => createNamedTool(subagentToolSpecs[3], pi, agentsDir);
export const createAbortTool = (pi: SubagentPi, agentsDir: string) => createNamedTool(subagentToolSpecs[4], pi, agentsDir);
export const createDetailTool = (pi: SubagentPi, agentsDir: string) => createNamedTool(subagentToolSpecs[5], pi, agentsDir);
export const createRunsTool = (pi: SubagentPi, agentsDir: string) => createNamedTool(subagentToolSpecs[6], pi, agentsDir);
export const createTools = (pi: SubagentPi, agentsDir: string) => [createRunTool(pi, agentsDir), createBatchTool(pi, agentsDir), createChainTool(pi, agentsDir), createContinueTool(pi, agentsDir), createAbortTool(pi, agentsDir), createDetailTool(pi, agentsDir), createRunsTool(pi, agentsDir)];
