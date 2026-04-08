import { defineTool } from "@mariozechner/pi-coding-agent";
import type { AgentToolResult, AgentToolUpdateCallback, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { readdirSync, readFileSync, existsSync } from "fs";
import { normalizeInput } from "./cli.js";
import { dispatchAbort, dispatchBatch, dispatchChain, dispatchContinue, dispatchRun } from "./dispatch.js";
import type { DispatchCtx } from "./dispatch.js";
import { loadAgentsFromDir, getAgent } from "./agents.js";
import { renderCall, renderResult, buildResultText } from "./render.js";
import { resultToRunTree } from "./run-tree.js";
import { formatDetail, formatRunsList } from "./tool-report.js";
import type { AgentConfig, SubagentPi, SubagentToolDetails, SubagentToolInput, Subcommand } from "./types.js";
import { SubagentParams } from "./params.js";

const result = (text: string, isError = false, details?: Omit<SubagentToolDetails, "isError">): AgentToolResult<SubagentToolDetails> => ({
	content: [{ type: "text", text }],
	details: { isError, ...details },
});
export const errorMsg = (e: unknown) => e instanceof Error ? e.message : String(e);
type UpdateFn = AgentToolUpdateCallback<SubagentToolDetails> | undefined;

async function dispatch(cmd: Subcommand, agents: AgentConfig[], ctx: DispatchCtx, onUpdate: UpdateFn, signal?: AbortSignal) {
	if (cmd.type === "runs") return result(formatRunsList());
	if (cmd.type === "detail") return result(formatDetail(cmd.id));
	if (cmd.type === "abort") return result(dispatchAbort(cmd.id));
	if (cmd.type === "run") return runSingle(cmd, agents, ctx, onUpdate, signal);
	if (cmd.type === "batch") return runBatch(cmd, agents, ctx, onUpdate, signal);
	if (cmd.type === "chain") return runChain(cmd, agents, ctx, onUpdate, signal);
	const cont = await dispatchContinue(cmd.id, cmd.task, agents, ctx, onUpdate, signal);
	return typeof cont === "string"
		? result(cont, cont.includes("not found"))
		: result(buildResultText(cont), !!cont.error, { runTrees: [resultToRunTree(cont)] });
}

async function runSingle(
	cmd: Extract<Subcommand, { type: "run" }>, agents: AgentConfig[], ctx: DispatchCtx, onUpdate: UpdateFn, signal?: AbortSignal,
) {
	const agent = getAgent(cmd.agent, agents);
	if (!agent) return result(`Unknown agent: ${cmd.agent}`, true);
	const out = await dispatchRun(agent, cmd.task, ctx, cmd.main, onUpdate, signal);
	return result(buildResultText(out), !!out.error, { runTrees: [resultToRunTree(out)] });
}

const runBatch = async (
	cmd: Extract<Subcommand, { type: "batch" }>, agents: AgentConfig[], ctx: DispatchCtx, onUpdate: UpdateFn, signal?: AbortSignal,
) => {
	const out = await dispatchBatch(cmd.items, agents, ctx, cmd.main, onUpdate, signal);
	return result(out.map((r) => buildResultText(r)).join("\n---\n"), out.some((r) => !!r.error), { runTrees: out.map(resultToRunTree) });
};

const runChain = async (
	cmd: Extract<Subcommand, { type: "chain" }>, agents: AgentConfig[], ctx: DispatchCtx, onUpdate: UpdateFn, signal?: AbortSignal,
) => {
	const out = await dispatchChain(cmd.steps, agents, ctx, cmd.main, onUpdate, signal);
	return result(buildResultText(out), !!out.error, { runTrees: [resultToRunTree(out)] });
};

const snippet = (agents: AgentConfig[]) => `Dispatch subagents: ${agents.map((a) => `${a.name} (${a.description})`).join(", ") || "none loaded"}`;
const guidelines = (agents: AgentConfig[]) => [
	"Available agents:",
	...agents.map((a) => `  - ${a.name}: ${a.description}`),
	"Call the tool with parameters like:",
	"  - { type: 'run', agent: 'scout', task: 'find auth code' }",
	"  - { type: 'batch', items: [{ agent: 'worker', task: 'implement login' }, { agent: 'reviewer', task: 'review login change' }] }",
	"  - { type: 'chain', steps: [{ agent: 'scout', task: 'find auth flow' }, { agent: 'worker', task: '{previous}' }] }",
	"  - { type: 'continue', id: 12, task: 'answer the question above' }",
	"  - { type: 'abort', id: 12 } / { type: 'detail', id: 12 } / { type: 'runs' }",
	"The tool blocks until the subagent completes and returns the full result.",
];

export function createTool(pi: SubagentPi, agentsDir: string) {
	const agents = existsSync(agentsDir) ? loadAgentsFromDir(agentsDir, (d) => readdirSync(d).map(String), readFileSync as (p: string, e: string) => string) : [];
	return defineTool({
		name: "subagent", label: "Subagent", description: "Run isolated subagent processes in separate pi subprocesses with their own context window",
		promptSnippet: snippet(agents), promptGuidelines: guidelines(agents), parameters: SubagentParams,
		async execute(_id: string, params: SubagentToolInput, signal: AbortSignal | undefined, onUpdate: UpdateFn, ctx: ExtensionContext) {
			try { return await dispatch(normalizeInput(params), agents, ctx, onUpdate, signal); }
			catch (e) { return result(`Error: ${errorMsg(e)}`, true); }
		},
		renderCall: (args: SubagentToolInput) => renderCall(args), renderResult: (res) => renderResult(res),
	});
}
