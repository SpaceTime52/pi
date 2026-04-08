import type { BridgeState, Ctx, EventName, HookRunResult } from "../core/types.js";
import { getDisabledRoots, getTrustedRoots } from "./store.js";

export function matcherMatches(matcher: string | undefined, value: string | undefined): boolean {
	if (!matcher || matcher === "" || matcher === "*") return true;
	if (!value) return false;
	try {
		return new RegExp(matcher).test(value);
	} catch {
		return false;
	}
}

export function textFromContent(content: any): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content.map((block) => block?.type === "text" ? String(block.text || "") : block?.type === "thinking" ? String(block.thinking || "") : block?.type === "toolCall" ? `[tool call ${block.name}]` : "").filter(Boolean).join("\n");
}

export function extractLastAssistantMessage(messages: any[]): string {
	for (let i = messages.length - 1; i >= 0; i--) if (messages[i]?.role === "assistant") return textFromContent(messages[i].content);
	return "";
}

export function hookSpecificOutput(result: HookRunResult, eventName: EventName): any {
	return result.parsedJson?.hookSpecificOutput?.hookEventName === eventName ? result.parsedJson.hookSpecificOutput : undefined;
}

export function plainAdditionalText(result: HookRunResult): string | undefined {
	return result.parsedJson ? undefined : result.stdout.trim() || undefined;
}

export async function ensureProjectHookTrust(_ctx: Ctx, state: BridgeState): Promise<boolean> {
	if (!state.hasRepoScopedHooks || getTrustedRoots().has(state.projectRoot)) return true;
	if (getDisabledRoots().has(state.projectRoot)) return false;
	getTrustedRoots().add(state.projectRoot);
	return true;
}
