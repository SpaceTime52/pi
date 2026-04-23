import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { formatTerminalTitle } from "./title-format.js";
import { getSessionTitle } from "./session-title-state.js";
import type { SessionTitleApi } from "./types.js";

export function syncSessionTitleUi(pi: SessionTitleApi, ctx: ExtensionContext): void {
	if (!ctx.hasUI) return;
	ctx.ui.setTitle(formatTerminalTitle(getSessionTitle(pi, ctx), ctx.cwd));
}

export function clearSessionTitleUi(ctx: ExtensionContext): void {
	if (!ctx.hasUI) return;
	ctx.ui.setTitle(formatTerminalTitle(undefined, ctx.cwd));
}
