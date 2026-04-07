import type { Ctx } from "../core/types.js";
import { clearDynamicWatchPaths } from "./watch-reset.js";
import { compactWarnings, getPromptedRoots, getTrustedRoots, refreshState } from "./store.js";

export function createClaudeBridgeCommand() {
	return { description: "Show Claude Code bridge status for the current cwd", handler: async (_args: string, ctx: Ctx) => {
		const state = await refreshState(ctx);
		if (!state.enabled) return ctx.ui.notify("No Claude Code files detected for this cwd.", "info");
		const activeRules = state.conditionalRules.filter((rule) => state.activeConditionalRuleIds.has(rule.id));
		const lines = [`projectRoot=${state.projectRoot}`, `trustedProjectHooks=${getTrustedRoots().has(state.projectRoot)}`, `instructions=${state.instructionFiles.length}`, `settings=${state.settingsFiles.length}`, `conditionalRules=${state.conditionalRules.length}`, `activeConditionalRules=${activeRules.length}`, `hookEvents=${Array.from(state.hooksByEvent.keys()).join(", ") || "none"}`];
		if (state.warnings.length > 0) lines.push(`warnings=${compactWarnings(state.warnings).join(" | ")}`);
		ctx.ui.notify(lines.join("\n"), "info");
	} };
}

export function createTrustHooksCommand() {
	return { description: "Trust repo-scoped Claude hooks for the current project in this session", handler: async (_args: string, ctx: Ctx) => {
		const state = await refreshState(ctx);
		getTrustedRoots().add(state.projectRoot);
	} };
}

export function createUntrustHooksCommand() {
	return { description: "Disable repo-scoped Claude hooks for the current project in this session", handler: async (_args: string, ctx: Ctx) => {
		const state = await refreshState(ctx);
		getTrustedRoots().delete(state.projectRoot);
		getPromptedRoots().delete(state.projectRoot);
		clearDynamicWatchPaths(state.projectRoot, state.fileWatchBasenames);
	} };
}
