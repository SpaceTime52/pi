import { STYLE_PROMPT, STYLE_SECTION } from "./constants.js";
import { isEnabled, restoreFromEntries, type BranchEntryLike } from "./state.js";

interface BranchReader {
	getBranch(): BranchEntryLike[];
}

interface SessionContextLike {
	sessionManager: BranchReader;
}

interface BeforeAgentStartEventLike {
	systemPrompt: string;
}

export function onRestore() {
	return async (_event: object, ctx: SessionContextLike) => {
		restoreFromEntries(ctx.sessionManager.getBranch());
	};
}

export function onBeforeAgentStart() {
	return async (event: BeforeAgentStartEventLike) => {
		if (!isEnabled()) return undefined;
		return {
			systemPrompt: `${event.systemPrompt}\n\n${STYLE_SECTION}\n${STYLE_PROMPT}`,
		};
	};
}
