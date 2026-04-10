import { getOverviewOverlayOptions, OverviewOverlayComponent } from "./overlay-component.js";
import type { OverviewContext, SessionOverview } from "./overview-types.js";

interface OverlayState {
	sessionId: string;
	component: OverviewOverlayComponent;
	handle?: { hide(): void };
}

let overlayState: OverlayState | undefined;

function hideOverviewOverlay(): void {
	overlayState?.handle?.hide();
	overlayState = undefined;
}

export function ensureOverviewOverlay(ctx: OverviewContext, overview?: SessionOverview, fallbackTitle?: string): void {
	if (!ctx.hasUI) return;
	const sessionId = ctx.sessionManager.getSessionId();
	if (overlayState && overlayState.sessionId !== sessionId) hideOverviewOverlay();
	if (overlayState) return overlayState.component.setContent(overview, fallbackTitle);
	void ctx.ui.custom<void>(
		(tui, theme) => {
			const component = new OverviewOverlayComponent(tui, theme, overview, fallbackTitle);
			overlayState = { sessionId, component };
			return component;
		},
		{ overlay: true, overlayOptions: getOverviewOverlayOptions(), onHandle: (handle) => {
			if (overlayState?.sessionId === sessionId) overlayState.handle = handle;
		} },
	).catch(() => {
		if (overlayState?.sessionId === sessionId) overlayState = undefined;
	});
}

export function clearOverlayState(): void {
	hideOverviewOverlay();
}
