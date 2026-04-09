import type { Ctx } from "../core/types.js";
import { buildClaudeInputBase } from "../hooks/tools.js";
import { extractLastAssistantMessage } from "./common.js";
import { runHandlers } from "./handlers.js";
import { clearSessionState, ensureState, getLastAssistantMessage, getStopHookActive, setLastAssistantMessage, setStopHookActive } from "./store.js";
import { compactLoads, emitInstructionLoads } from "./instructions-loaded.js";
import { stopBridgeWatchLoop } from "./watch.js";
import { clearWatchState } from "./watch-store.js";

export function createAgentEndHandler(pi: any) {
	return async (event: any, ctx: Ctx) => {
		const state = await ensureState(ctx);
		if (!state.enabled) return;
		const lastAssistantMessage = getLastAssistantMessage() || extractLastAssistantMessage(event.messages || []);
		const results = await runHandlers(pi, "Stop", undefined, { ...buildClaudeInputBase(ctx, "Stop"), stop_hook_active: getStopHookActive(), last_assistant_message: lastAssistantMessage }, ctx);
		for (const result of results) {
			if (result.code !== 2 && result.parsedJson?.decision !== "block") continue;
			setStopHookActive(true);
			pi.sendUserMessage(result.stderr.trim() || result.parsedJson?.reason || "Claude Stop hook requested continuation.");
			return;
		}
		setStopHookActive(false);
	};
}

export function createSessionBeforeCompactHandler(pi: any) {
	return async (event: any, ctx: Ctx) => void (await runCompactHook(pi, "PreCompact", { trigger: "manual", custom_instructions: event.customInstructions || "" }, ctx));
}

export function createSessionCompactHandler(pi: any) {
	return async (event: any, ctx: Ctx) => {
		await runCompactHook(pi, "PostCompact", { trigger: "manual", compact_summary: event.compactionEntry?.summary || "" }, ctx);
		await emitInstructionLoads(pi, ctx, compactLoads());
	};
}

export function createAssistantMessageEndHandler() {
	return async (event: any) => {
		if (event.message?.role !== "assistant") return;
		setLastAssistantMessage(extractLastAssistantMessage([event.message]));
	};
}

export function createSessionShutdownHandler(pi: any) {
	return async (_event: any, ctx: Ctx) => {
		stopBridgeWatchLoop();
		await runCompactHook(pi, "SessionEnd", { reason: "other" }, ctx);
		clearSessionState();
		clearWatchState();
	};
}

async function runCompactHook(pi: any, eventName: any, extra: any, ctx: Ctx) {
	const state = await ensureState(ctx);
	if (!state.enabled) return;
	await runHandlers(pi, eventName, eventName === "SessionEnd" ? "other" : "manual", { ...buildClaudeInputBase(ctx, eventName), ...extra }, ctx);
}
