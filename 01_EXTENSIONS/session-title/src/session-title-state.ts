import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { extractSessionFilePath, isSubagentSessionPath } from "./session-path.js";
import { looksLikePromptCopy } from "./title-format.js";
import type { SessionTitleApi } from "./types.js";

export function getSessionTitle(pi: SessionTitleApi, ctx: ExtensionContext): string | undefined {
	const currentTitle = pi.getSessionName()?.trim();
	if (currentTitle) return currentTitle;
	try {
		const getSessionName = ctx.sessionManager.getSessionName;
		if (typeof getSessionName !== "function") return undefined;
		const restoredTitle = String(getSessionName() ?? "").trim();
		return restoredTitle || undefined;
	} catch {
		return undefined;
	}
}

export function shouldReplaceSessionTitle(currentTitle: string | undefined, userPrompt: string): boolean {
	if (!currentTitle?.trim()) return true;
	if (!userPrompt.trim()) return false;
	return looksLikePromptCopy(currentTitle, userPrompt);
}

export function shouldAutoNameSession(pi: SessionTitleApi, ctx: ExtensionContext, userPrompt: string, namingInFlight: boolean): boolean {
	if (namingInFlight) return false;
	if (!userPrompt.trim()) return false;
	if (isSubagentSessionPath(extractSessionFilePath(ctx.sessionManager))) return false;
	return shouldReplaceSessionTitle(getSessionTitle(pi, ctx), userPrompt);
}
