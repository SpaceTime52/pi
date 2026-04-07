import { existsSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { extractMainContext, type Entry } from "./context.js";
import { unregisterRun } from "./run-progress.js";
import { getPiCommand, buildArgs } from "./runner.js";
import { addToHistory } from "./session.js";
import type { AgentConfig, RunResult } from "./types.js";
import type { DispatchCtx } from "./run-factory.js";

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

export function finishRun(result: RunResult, sessionFile: string, events: NonNullable<Parameters<typeof addToHistory>[0]["events"]>) {
	addToHistory({ id: result.id, agent: result.agent, task: result.task, output: result.output, error: result.error, sessionFile, events });
	unregisterRun(result.id);
	return result;
}

export function failRun(e: unknown, id: number, agent: string, task: string, sessionFile: string, events: NonNullable<Parameters<typeof addToHistory>[0]["events"]>): never {
	addToHistory({ id, agent, task, output: "", error: errorMsg(e), sessionFile, events });
	unregisterRun(id);
	throw e;
}
