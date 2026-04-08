import { existsSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { extractMainContext, type Entry } from "./context.js";
import { unregisterRun } from "./run-progress.js";
import { getPiCommand, buildArgs } from "./runner.js";
import { addToHistory } from "./session.js";
import { getRun } from "./store.js";
import type { AgentConfig, RunResult, RunStatus } from "./types.js";
import type { DispatchCtx } from "./run-factory.js";
import { rememberCompletedRun } from "./widget.js";

export const errorMsg = (e: unknown) => e instanceof Error ? e.message : String(e);

export function buildPrompt(agent: AgentConfig, ctx: DispatchCtx, main: boolean) {
	if (!main) return agent.systemPrompt;
	const summary = extractMainContext(ctx.sessionManager.getBranch() as Entry[], 20);
	return summary ? `${agent.systemPrompt}\n\n[Main Context]\n${summary}` : agent.systemPrompt;
}

export function buildRunCommand(agent: AgentConfig, task: string, sessionFile: string, prompt: string | undefined, id: number) {
	const { cmd, base } = getPiCommand(process.execPath, process.argv[1], existsSync);
	const promptPath = prompt ? join(tmpdir(), `pi-sub-${agent.name}-${id}.md`) : "";
	const args = buildArgs({ base, model: agent.model, thinking: agent.thinking, tools: agent.tools, systemPromptPath: promptPath, task, sessionPath: sessionFile });
	if (!prompt) args.splice(args.indexOf("--append-system-prompt"), 2);
	return { cmd, args };
}

export function ensureSessionDir(file: string) {
	const dir = dirname(file);
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function statusForRun(result: Pick<RunResult, "error" | "escalation">): RunStatus {
	if (result.error) return "error";
	if (result.escalation) return "escalation";
	return "ok";
}

export function finishRun(result: RunResult, sessionFile: string, events: NonNullable<Parameters<typeof addToHistory>[0]["events"]>) {
	const active = getRun(result.id);
	if (active) {
		rememberCompletedRun({
			id: result.id,
			agent: result.agent,
			task: result.task,
			startedAt: active.startedAt,
			finishedAt: Date.now(),
			status: statusForRun(result),
			summary: result.error ?? result.escalation ?? result.stopReason,
			runTrees: result.runTrees,
		});
	}
	addToHistory({ id: result.id, agent: result.agent, task: result.task, output: result.output, error: result.error, sessionFile, events, runTrees: result.runTrees });
	unregisterRun(result.id);
	return result;
}

export function failRun(e: unknown, id: number, agent: string, task: string, sessionFile: string, events: NonNullable<Parameters<typeof addToHistory>[0]["events"]>): never {
	const active = getRun(id), message = errorMsg(e);
	if (active) {
		rememberCompletedRun({
			id,
			agent,
			task,
			startedAt: active.startedAt,
			finishedAt: Date.now(),
			status: "error",
			summary: message,
		});
	}
	addToHistory({ id, agent, task, output: "", error: message, sessionFile, events, runTrees: undefined });
	unregisterRun(id);
	throw e;
}
