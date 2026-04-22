import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { applyClaudeChrome } from "./chrome.js";

export async function onSessionStart(_event: unknown, ctx: ExtensionContext) {
	if (!ctx.hasUI) return;
	applyClaudeChrome(ctx);
}
