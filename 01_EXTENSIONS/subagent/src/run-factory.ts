import { writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { DEFAULT_HARD_TIMEOUT_MS, DEFAULT_IDLE_TIMEOUT_MS, MAX_RETRIES, RETRY_BASE_MS } from "./constants.js";
import { makeOnEvent, registerRun } from "./run-progress.js";
import { withRetry } from "./retry.js";
import { sessionPath } from "./session.js";
import { spawnAndCollect } from "./spawn.js";
import { nextId } from "./store.js";
import { buildPrompt, buildRunCommand, ensureSessionDir, errorMsg, failRun, finishRun } from "./run-factory-support.js";
import type { AgentConfig, RunResult, SubagentToolDetails } from "./types.js";
import type { AgentToolUpdateCallback } from "@mariozechner/pi-coding-agent";

export interface DispatchCtx { hasUI: boolean; ui: { setWidget(k: string, v: unknown, o?: unknown): void }; sessionManager: { getBranch(): unknown[] } }
type OnUpdate = AgentToolUpdateCallback<SubagentToolDetails> | undefined;

export const createRunner = (main: boolean, ctx: DispatchCtx, onUpdate?: OnUpdate, outerSignal?: AbortSignal) => async (agent: AgentConfig, task: string) => {
	const id = nextId();
	return runAgent({ id, agent, task, ctx, onUpdate, outerSignal, sessionFile: sessionPath(id), prompt: buildPrompt(agent, ctx, main) });
};

export const createSessionRunner = (sessFile: string, ctx: DispatchCtx, onUpdate?: OnUpdate, outerSignal?: AbortSignal) => async (agent: AgentConfig, task: string) => {
	const id = nextId();
	return runAgent({ id, agent, task, ctx, onUpdate, outerSignal, sessionFile: sessFile });
};

async function runAgent(input: {
	id: number;
	agent: AgentConfig;
	task: string;
	ctx: DispatchCtx;
	onUpdate?: OnUpdate;
	outerSignal?: AbortSignal;
	sessionFile: string;
	prompt?: string;
}): Promise<RunResult> {
	const id = input.id;
	if (input.prompt) writeFileSync(join(tmpdir(), `pi-sub-${input.agent.name}-${id}.md`), input.prompt);
	ensureSessionDir(input.sessionFile);
	const { cmd, args } = buildRunCommand(input.agent, input.task, input.sessionFile, input.prompt, id);
	const ac = new AbortController();
	const events: Parameters<typeof finishRun>[2] = [];
	const abortFromOuter = () => ac.abort();
	let removeOuterAbortListener = () => {};
	if (input.outerSignal) {
		const outerSignal = input.outerSignal;
		removeOuterAbortListener = () => outerSignal.removeEventListener("abort", abortFromOuter);
		if (outerSignal.aborted) ac.abort();
		else outerSignal.addEventListener("abort", abortFromOuter, { once: true });
	}
	registerRun(id, input.agent.name, input.task, input.ctx, ac);
	const onEvent = makeOnEvent(id, input.agent.name, input.task, input.ctx, events, input.onUpdate);
	let result: RunResult | undefined;
	let failed = false;
	let failure: unknown;
	try {
		result = await withRetry(
			() => spawnAndCollect(cmd, args, id, input.agent.name, ac.signal, onEvent, {
				hardTimeoutMs: DEFAULT_HARD_TIMEOUT_MS,
				idleTimeoutMs: DEFAULT_IDLE_TIMEOUT_MS,
			}),
			MAX_RETRIES,
			RETRY_BASE_MS,
		);
	} catch (e) {
		failed = true;
		failure = e;
	}
	removeOuterAbortListener();
	if (failed) return failRun(failure, id, input.agent.name, input.task, input.sessionFile, events);
	return finishRun({ ...result!, task: input.task }, input.sessionFile, events);
}

export { errorMsg };
