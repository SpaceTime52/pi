import { getOverviewOverlayOptions, OverviewOverlayComponent } from "./overlay-component.js";
import type { OverviewContext, SessionOverview } from "./overview-types.js";

const NARROW_WIDGET_KEY = "auto-session-title.narrow";
const NARROW_WIDGET_BREAKPOINT = 185;

type DisplayMode = "overlay" | "widget";
interface OverlayState {
	overlayId: number;
	sessionId: string;
	ctx: OverviewContext;
	layoutKey: string;
	mode: DisplayMode;
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

function modeForWidth(termWidth?: number): DisplayMode {
	return process.stdout.isTTY === true && typeof termWidth === "number" && termWidth < NARROW_WIDGET_BREAKPOINT ? "widget" : "overlay";
}

function hideOverviewOverlay(): void {
	if (overlayState?.resizeListener) process.stdout.off("resize", overlayState.resizeListener);
	if (overlayState?.mode === "widget") overlayState.ctx.ui.setWidget(NARROW_WIDGET_KEY, undefined);
	else overlayState?.handle?.hide();
	overlayState = undefined;
}

function attachResizeListener(sessionId: string, overlayId: number): (() => void) | undefined {
	if (typeof process.stdout.on !== "function" || typeof process.stdout.off !== "function") return undefined;
	const listener = () => {
		if (!overlayState || overlayState.sessionId !== sessionId || overlayState.overlayId !== overlayId || overlayState.layoutKey === getLayoutKey()) return;
		const { ctx, overview, fallbackTitle } = overlayState;
		hideOverviewOverlay();
		ensureOverviewOverlay(ctx, overview, fallbackTitle);
	};
	process.stdout.on("resize", listener);
	return listener;
}

function showOverviewWidget(ctx: OverviewContext, overlayId: number, sessionId: string, layoutKey: string, overview?: SessionOverview, fallbackTitle?: string): void {
	ctx.ui.setWidget(NARROW_WIDGET_KEY, (tui, theme) => {
		const component = new OverviewOverlayComponent(tui, theme, overview, fallbackTitle);
		overlayState = { overlayId, sessionId, ctx, layoutKey, mode: "widget", component, overview, fallbackTitle };
		overlayState.resizeListener = attachResizeListener(sessionId, overlayId);
		return component;
	}, { placement: "belowEditor" });
}

export function ensureOverviewOverlay(ctx: OverviewContext, overview?: SessionOverview, fallbackTitle?: string): void {
	if (!ctx.hasUI) return;
	const sessionId = ctx.sessionManager.getSessionId(), layoutKey = getLayoutKey(), mode = modeForWidth(process.stdout.columns);
	if (overlayState && (overlayState.sessionId !== sessionId || overlayState.layoutKey !== layoutKey || overlayState.mode !== mode)) hideOverviewOverlay();
	if (overlayState) {
		overlayState.overview = overview;
		overlayState.fallbackTitle = fallbackTitle;
		return overlayState.component.setContent(overview, fallbackTitle);
	}
	const overlayId = ++nextOverlayId;
	if (mode === "widget") return showOverviewWidget(ctx, overlayId, sessionId, layoutKey, overview, fallbackTitle);
	void ctx.ui.custom<void>((tui, theme) => {
		const component = new OverviewOverlayComponent(tui, theme, overview, fallbackTitle);
		overlayState = { overlayId, sessionId, ctx, layoutKey, mode, component, overview, fallbackTitle };
		overlayState.resizeListener = attachResizeListener(sessionId, overlayId);
		return component;
	}, { overlay: true, overlayOptions: getOverviewOverlayOptions(process.stdout.columns), onHandle: (handle) => {
		if (overlayState?.overlayId === overlayId) overlayState.handle = handle;
	} }).catch(() => {
		if (overlayState?.overlayId === overlayId) hideOverviewOverlay();
	});
}

export function clearOverlayState(): void {
	hideOverviewOverlay();
}
