import type { BridgeState } from "../core/types.js";
import { buildInstructionSection } from "../core/instructions.js";
import { scopeLabel } from "../core/pathing.js";

let cachedActiveRuleIdsKey = "";
let cachedActiveRuleSection: string | undefined;

export function getActiveRuleSection(state: BridgeState): string | undefined {
	if (state.activeConditionalRuleIds.size === 0) {
		resetDynamicContextCache();
		return undefined;
	}
	const nextKey = Array.from(state.activeConditionalRuleIds).join("\n");
	if (cachedActiveRuleIdsKey === nextKey) return cachedActiveRuleSection;
	const activeRules = state.conditionalRules.filter((rule) => state.activeConditionalRuleIds.has(rule.id));
	cachedActiveRuleIdsKey = nextKey;
	cachedActiveRuleSection = activeRules.length > 0 ? renderRuleSection(activeRules) : undefined;
	return cachedActiveRuleSection;
}

export function resetDynamicContextCache() {
	cachedActiveRuleIdsKey = "";
	cachedActiveRuleSection = undefined;
}

function renderRuleSection(rules: BridgeState["conditionalRules"]) {
	return "## Active path-scoped Claude rules\n" + rules.map((rule) => buildInstructionSection(`Conditional rule (${scopeLabel(rule.scope)})`, rule.path, rule.content)).join("\n\n");
}
