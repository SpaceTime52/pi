import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { TITLE_STATUS_KEY, formatStatusTitle, formatTerminalTitle } from "./title-format.js";
import { getSessionTitle } from "./session-title-state.js";
import type { SessionTitleApi } from "./types.js";

export function syncSessionTitleUi(pi: SessionTitleApi, ctx: ExtensionContext): void {
	if (!ctx.hasUI) return;
	const sessionTitle = getSessionTitle(pi, ctx);
	ctx.ui.setStatus(TITLE_STATUS_KEY, sessionTitle ? formatStatusTitle(sessionTitle) : undefined);
	ctx.ui.setTitle(formatTerminalTitle(sessionTitle, ctx.cwd));
}

export function clearSessionTitleUi(ctx: ExtensionContext): void {
	if (!ctx.hasUI) return;
	ctx.ui.setStatus(TITLE_STATUS_KEY, undefined);
	ctx.ui.setTitle(formatTerminalTitle(undefined, ctx.cwd));
}
