import type { Ctx } from "../core/types.js";
import { buildClaudeInputBase } from "../hooks/tools.js";
import { buildDynamicContext, ensureState, filterFreshAsyncBridgeMessages, queueAdditionalContext, refreshState } from "./store.js";
import { hookSpecificOutput, plainAdditionalText } from "./common.js";
import { runHandlers } from "./handlers.js";
import { emitInstructionLoads } from "./instructions-loaded.js";
import { startWatchLoop } from "./watch.js";

export function createSessionStartHandler(pi: any) {
	return async (event: any, ctx: Ctx) => {
		const state = await refreshState(ctx);
		await startWatchLoop(pi, ctx);
		if (!state.enabled) return;
		const source = event.reason === "resume" ? "resume" : "startup";
		const results = await runHandlers(pi, "SessionStart", source, { ...buildClaudeInputBase(ctx, "SessionStart"), source, pi_source: event.reason, model: `${ctx.model?.provider || "unknown"}/${ctx.model?.id || "unknown"}` }, ctx);
		await emitInstructionLoads(pi, ctx, state.eagerLoads);
		queueAdditionalContext(results.flatMap((result) => [hookSpecificOutput(result, "SessionStart")?.additionalContext, plainAdditionalText(result)]));
	};
}

export async function handleBeforeAgentStart(event: any, ctx: Ctx) {
	const state = await ensureState(ctx);
	if (!state.enabled || !state.unconditionalPromptText.trim()) return;
	return { systemPrompt: `${event.systemPrompt}\n\n## Claude Code Bridge\nThe current project contains Claude Code instructions. Follow them as project policy.\n\n${state.unconditionalPromptText}` };
}

export async function handleContext(event: any, ctx: Ctx) {
	const state = await ensureState(ctx);
	const originalMessages = event.messages || [];
	const filteredMessages = filterFreshAsyncBridgeMessages(originalMessages);
	const dynamicContext = state.enabled ? buildDynamicContext(state) : undefined;
	if (!dynamicContext) return filteredMessages.length === originalMessages.length ? undefined : { messages: filteredMessages };
	return { messages: [...filteredMessages, { role: "custom", customType: "claude-bridge", content: dynamicContext, display: false, timestamp: Date.now() }] };
}
