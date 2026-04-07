import { spawn } from "child_process";
import { createInterface } from "readline";
import { parseLine } from "./parser.js";
import { buildResult, clearOptionalTimer, killWithGrace } from "./spawn-support.js";
import type { ParsedEvent } from "./parser.js";
import type { RunResult } from "./types.js";

interface SpawnOptions {
	hardTimeoutMs?: number;
	idleTimeoutMs?: number;
}

export function spawnAndCollect(
	cmd: string,
	args: string[],
	id: number,
	agentName: string,
	signal?: AbortSignal,
	onEvent?: (evt: ParsedEvent) => void,
	options: SpawnOptions = {},
): Promise<RunResult> {
	return new Promise((resolve, reject) => {
		const proc = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
		const events: ParsedEvent[] = [];
		const stderrChunks: string[] = [];
		const rl = createInterface({ input: proc.stdout });
		let settled = false;
		let closed = false;
		let killTimer: ReturnType<typeof setTimeout> | undefined;
		let hardTimer: ReturnType<typeof setTimeout> | undefined;
		let idleTimer: ReturnType<typeof setTimeout> | undefined;
		const cleanup = (keepKillTimer = false) => {
			if (!keepKillTimer) {
				clearOptionalTimer(killTimer);
				killTimer = undefined;
			}
			clearOptionalTimer(hardTimer);
			clearOptionalTimer(idleTimer);
			hardTimer = undefined;
			idleTimer = undefined;
			signal?.removeEventListener("abort", onAbort);
			rl.close();
		};
		const finishResolve = (result: RunResult) => {
			settled = true;
			cleanup();
			resolve(result);
		};
		const finishReject = (err: Error, keepKillTimer = false) => {
			settled = true;
			cleanup(keepKillTimer);
			reject(err);
		};
		const killProc = () => killWithGrace(proc, () => closed, (timer) => { killTimer = timer; });
		const failForTimeout = (label: "idle" | "hard", timeoutMs: number) => {
			/* c8 ignore next */
			if (settled) return;
			killProc();
			finishReject(new Error(`Subagent ${label} timeout after ${Math.ceil(timeoutMs / 1000)}s`), true);
		};
		const scheduleIdleTimeout = () => {
			clearOptionalTimer(idleTimer);
			if (!options.idleTimeoutMs || options.idleTimeoutMs <= 0) return;
			idleTimer = setTimeout(() => failForTimeout("idle", options.idleTimeoutMs!), options.idleTimeoutMs);
		};
		const onAbort = () => {
			if (settled) return;
			killProc();
			finishReject(new Error("Aborted"), true);
		};
		if (options.hardTimeoutMs && options.hardTimeoutMs > 0) {
			hardTimer = setTimeout(() => failForTimeout("hard", options.hardTimeoutMs!), options.hardTimeoutMs);
		}
		scheduleIdleTimeout();
		if (signal?.aborted) return onAbort();
		signal?.addEventListener("abort", onAbort, { once: true });
		rl.on("line", (line) => {
			scheduleIdleTimeout();
			const evt = parseLine(line);
			if (evt) {
				events.push(evt);
				onEvent?.(evt);
			}
		});
		proc.stderr.on("data", (chunk: Buffer) => {
			stderrChunks.push(chunk.toString());
			scheduleIdleTimeout();
		});
		proc.on("error", (err) => {
			if (!settled) finishReject(err);
		});
		proc.on("close", (code) => {
			closed = true;
			if (settled) return cleanup();
			finishResolve(buildResult(id, agentName, events, stderrChunks, code));
		});
	});
}
