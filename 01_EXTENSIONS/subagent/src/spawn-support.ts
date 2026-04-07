import { TERMINATION_GRACE_MS } from "./constants.js";
import { buildMissingOutputDiagnostic, collectOutput } from "./runner.js";
import type { ParsedEvent } from "./parser.js";
import type { RunResult } from "./types.js";

export function clearOptionalTimer(timer: ReturnType<typeof setTimeout> | undefined) {
	if (timer) clearTimeout(timer);
}

export function killWithGrace(
	proc: { kill(signal: NodeJS.Signals): boolean },
	isClosed: () => boolean,
	setKillTimer: (timer: ReturnType<typeof setTimeout>) => void,
) {
	proc.kill("SIGTERM");
	setKillTimer(setTimeout(() => {
		if (!isClosed()) proc.kill("SIGKILL");
	}, TERMINATION_GRACE_MS));
}

export function buildResult(
	id: number,
	agentName: string,
	events: ParsedEvent[],
	stderrChunks: string[],
	code: number | null,
): RunResult {
	const summary = collectOutput(events);
	const stderr = stderrChunks.join("").trim();
	const result: RunResult = {
		id,
		agent: agentName,
		output: summary.output,
		usage: summary.usage,
		escalation: summary.escalation,
		stopReason: summary.stopReason,
		runTrees: summary.runTrees,
	};
	if (code !== 0) {
		result.error = stderr || `Process exited with code ${code}`;
		if (!result.output) result.output = buildMissingOutputDiagnostic({ ...summary, stderr, exitCode: code });
		return result;
	}
	if (!result.output.trim()) {
		result.error = "Subagent finished without a visible assistant result";
		result.output = buildMissingOutputDiagnostic({ ...summary, stderr, exitCode: code });
	}
	return result;
}
