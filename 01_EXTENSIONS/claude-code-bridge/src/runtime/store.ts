import type { BridgeState, Ctx } from "../core/types.js";
import { buildInstructionSection } from "../core/instructions.js";
import { scopeLabel } from "../core/pathing.js";
import { loadState } from "../state/collect.js";

let activeState: BridgeState | null = null;
let queuedHookContext: string[] = [];
let stopHookActive = false;
let stateDirty = true;
let lastAssistantMessage = "";
const warned = new Set<string>();
const trustedRoots = new Set<string>();
const disabledRoots = new Set<string>();

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
	const activeRules = state.conditionalRules.filter((rule) => state.activeConditionalRuleIds.has(rule.id));
	const sections = [
		activeRules.length > 0 ? "## Active path-scoped Claude rules\n" + activeRules.map((rule) => buildInstructionSection(`Conditional rule (${scopeLabel(rule.scope)})`, rule.path, rule.content)).join("\n\n") : "",
		queuedHookContext.length > 0 ? `## Claude hook context\n${queuedHookContext.join("\n\n")}` : "",
	].filter(Boolean);
	queuedHookContext = [];
	return sections.length > 0 ? sections.join("\n\n") : undefined;
}

export function getStopHookActive() {
	return stopHookActive;
}

export function setStopHookActive(value: boolean) {
	stopHookActive = value;
}

export function getLastAssistantMessage() {
	return lastAssistantMessage;
}

export function setLastAssistantMessage(value: string) {
	lastAssistantMessage = value;
}

export function getTrustedRoots() {
	return trustedRoots;
}

export function getDisabledRoots() {
	return disabledRoots;
}

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
	clearTrustState();
}
