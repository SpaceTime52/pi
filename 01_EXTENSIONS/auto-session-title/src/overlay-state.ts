import { getOverviewOverlayOptions, OverviewOverlayComponent } from "./overlay-component.js";
import type { OverviewContext, SessionOverview } from "./overview-types.js";

interface OverlayState {
	overlayId: number;
	sessionId: string;
	ctx: OverviewContext;
	layoutKey: string;
	component: OverviewOverlayComponent;
	overview?: SessionOverview;
	fallbackTitle?: string;
	handle?: { hide(): void };
	resizeListener?: () => void;
}

let overlayState: OverlayState | undefined;
let nextOverlayId = 0;

function getLayoutKey(): string {
	return `${process.stdout.columns ?? "unknown"}:${process.stdout.rows ?? "unknown"}`;
}

function hideOverviewOverlay(): void {
	if (overlayState?.resizeListener) process.stdout.off("resize", overlayState.resizeListener);
	overlayState?.handle?.hide();
	overlayState = undefined;
}

function attachResizeListener(sessionId: string, overlayId: number): (() => void) | undefined {
	if (typeof process.stdout.on !== "function" || typeof process.stdout.off !== "function") return undefined;
	const listener = () => {
		if (!overlayState || overlayState.sessionId !== sessionId || overlayState.overlayId !== overlayId) return;
		if (overlayState.layoutKey === getLayoutKey()) return;
		const { ctx, overview, fallbackTitle } = overlayState;
		hideOverviewOverlay();
		ensureOverviewOverlay(ctx, overview, fallbackTitle);
	};
	process.stdout.on("resize", listener);
	return listener;
}

export function ensureOverviewOverlay(ctx: OverviewContext, overview?: SessionOverview, fallbackTitle?: string): void {
	if (!ctx.hasUI) return;
	const sessionId = ctx.sessionManager.getSessionId();
	const layoutKey = getLayoutKey();
	if (overlayState && (overlayState.sessionId !== sessionId || overlayState.layoutKey !== layoutKey)) hideOverviewOverlay();
	if (overlayState) {
		overlayState.overview = overview;
		overlayState.fallbackTitle = fallbackTitle;
		return overlayState.component.setContent(overview, fallbackTitle);
	}
	const overlayId = ++nextOverlayId;
	void ctx.ui.custom<void>(
		(tui, theme) => {
			const component = new OverviewOverlayComponent(tui, theme, overview, fallbackTitle);
			overlayState = { overlayId, sessionId, ctx, layoutKey, component, overview, fallbackTitle };
			overlayState.resizeListener = attachResizeListener(sessionId, overlayId);
			return component;
		},
		{ overlay: true, overlayOptions: getOverviewOverlayOptions(process.stdout.columns), onHandle: (handle) => {
			if (overlayState?.overlayId === overlayId) overlayState.handle = handle;
		} },
	).catch(() => {
		if (overlayState?.overlayId === overlayId) hideOverviewOverlay();
	});
}

export function clearOverlayState(): void {
	hideOverviewOverlay();
}
