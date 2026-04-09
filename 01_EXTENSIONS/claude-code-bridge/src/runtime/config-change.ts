import type { Ctx, PiBridge } from "../core/types.js";
import { buildClaudeInputBase } from "../hooks/tools.js";
import { runHandlers } from "./handlers.js";
import { appendWarning, getState, markStateDirty, refreshState } from "./store.js";
import { classifyConfigSource } from "./watch-scan.js";

export async function handleConfigChanges(pi: PiBridge, ctx: Ctx, paths: string[]) {
	const blockedPaths: string[] = [];
	for (const path of paths) {
		const source = classifyConfigSource(path);
		if (!source) {
			markStateDirty();
			await refreshState(ctx);
			continue;
		}
		const state = getState();
		if (state?.enabled) {
			const results = await runHandlers(pi, "ConfigChange", source, { ...buildClaudeInputBase(ctx, "ConfigChange"), source, file_path: path }, ctx);
			if (isBlocked(results)) {
				appendWarning(ctx, `Blocked Claude config change for ${path}`);
				blockedPaths.push(path);
				continue;
			}
		}
		markStateDirty();
		await refreshState(ctx);
	}
	return { blockedPaths };
}

function isBlocked(results: Array<{ code: number; parsedJson?: any }>) {
	return results.some((result) => result.code === 2 || result.parsedJson?.decision === "block");
}
