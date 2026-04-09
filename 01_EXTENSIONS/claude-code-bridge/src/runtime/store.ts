import type { BridgeState, Ctx } from "../core/types.js";
import { loadState } from "../state/collect.js";
import { clearAsyncBridgeMessages, filterFreshAsyncBridgeMessages } from "./async-bridge-messages.js";
import { getActiveRuleSection, resetDynamicContextCache } from "./dynamic-context-cache.js";

let activeState: BridgeState | null = null;
let queuedHookContext: string[] = [];
let stopHookActive = false;
let stateDirty = true;
let lastAssistantMessage = "";
const warned = new Set<string>();
const trustedRoots = new Set<string>();
const disabledRoots = new Set<string>();

export { filterFreshAsyncBridgeMessages };

export function getState() {
	return activeState;
}

export async function ensureState(ctx: Ctx): Promise<BridgeState> {
	if (activeState && !stateDirty && activeState.cwd === ctx.cwd) return activeState;
	return await refreshState(ctx);
}

export async function refreshState(ctx: Ctx): Promise<BridgeState> {
	const previousState = activeState;
	const next = await loadState(ctx.cwd);
	if (previousState && previousState.projectRoot === next.projectRoot) next.activeConditionalRuleIds = previousState.activeConditionalRuleIds;
	if (next.hasRepoScopedHooks && !disabledRoots.has(next.projectRoot)) trustedRoots.add(next.projectRoot);
	activeState = next;
	stateDirty = false;
	resetDynamicContextCache();
	for (const warning of compactWarnings(next.warnings)) appendWarning(ctx, warning);
	return next;
}

export function markStateDirty() {
	stateDirty = true;
}

export function appendWarning(_ctx: Ctx | undefined, message: string) {
	if (warned.has(message)) return;
	warned.add(message);
}

export function compactWarnings(warnings: string[]): string[] {
	return [...new Set(warnings)];
}

export function queueAdditionalContext(texts: Array<string | undefined>) {
	for (const text of texts) if (text?.trim()) queuedHookContext.push(text.trim());
}

export function buildDynamicContext(state: BridgeState): string | undefined {
	const sections = [getActiveRuleSection(state) || "", queuedHookContext.length > 0 ? `## Claude hook context\n${queuedHookContext.join("\n\n")}` : ""].filter(Boolean);
	queuedHookContext = [];
	return sections.length > 0 ? sections.join("\n\n") : undefined;
}

export const getStopHookActive = () => stopHookActive;
export const setStopHookActive = (value: boolean) => void (stopHookActive = value);
export const getLastAssistantMessage = () => lastAssistantMessage;
export const setLastAssistantMessage = (value: string) => void (lastAssistantMessage = value);
export const getTrustedRoots = () => trustedRoots;
export const getDisabledRoots = () => disabledRoots;

export function clearTrustState() {
	trustedRoots.clear();
	disabledRoots.clear();
}

export function clearSessionState() {
	activeState = null;
	queuedHookContext = [];
	stopHookActive = false;
	stateDirty = true;
	lastAssistantMessage = "";
	warned.clear();
	clearAsyncBridgeMessages();
	resetDynamicContextCache();
	clearTrustState();
}
