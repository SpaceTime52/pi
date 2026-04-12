import { getOverviewOverlayOptions, OverviewOverlayComponent, type OverviewRenderOptions } from "./overlay-component.js";
import type { OverviewContext, SessionOverview } from "./overview-types.js";

const NARROW_WIDGET_KEY = "auto-session-title.narrow";
const NARROW_WIDGET_BREAKPOINT = 185;
const OVERVIEW_COMPACT_ROWS = 18;
const OVERVIEW_CONDENSED_ROWS = 24;

type DisplayMode = "overlay" | "widget";
interface OverviewPresentation { mode: DisplayMode; renderOptions: OverviewRenderOptions; widgetOptions?: { placement?: "belowEditor" } }
interface OverlayState {
	overlayId: number;
	sessionId: string;
	ctx: OverviewContext;
	layoutKey: string;
	mode: DisplayMode;
	component: OverviewOverlayComponent;
	overview?: SessionOverview;
	fallbackTitle?: string;
	presentation: OverviewPresentation;
	handle?: { hide(): void };
	resizeListener?: () => void;
}

let overlayState: OverlayState | undefined;
let nextOverlayId = 0;
const getLayoutKey = () => `${process.stdout.columns ?? "unknown"}:${process.stdout.rows ?? "unknown"}`;
const modeForWidth = (termWidth?: number): DisplayMode => process.stdout.isTTY === true && typeof termWidth === "number" && termWidth < NARROW_WIDGET_BREAKPOINT ? "widget" : "overlay";

function resolvePresentation(termWidth?: number, termHeight?: number): OverviewPresentation {
	const mode = modeForWidth(termWidth);
	if (mode === "widget") return { mode, renderOptions: { compact: true } };
	if (typeof termHeight === "number") {
		if (termHeight < OVERVIEW_COMPACT_ROWS) return { mode, renderOptions: { compact: true } };
		if (termHeight < OVERVIEW_CONDENSED_ROWS) return { mode, renderOptions: { maxBodyLines: 1 } };
	}
	return { mode, renderOptions: {} };
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

function updateExistingOverlay(presentation: OverviewPresentation, overview?: SessionOverview, fallbackTitle?: string): void {
	overlayState!.overview = overview;
	overlayState!.fallbackTitle = fallbackTitle;
	overlayState!.presentation = presentation;
	overlayState!.component.setContent(overview, fallbackTitle, presentation.renderOptions);
}

function showOverviewWidget(ctx: OverviewContext, overlayId: number, sessionId: string, layoutKey: string, presentation: OverviewPresentation, overview?: SessionOverview, fallbackTitle?: string): void {
	ctx.ui.setWidget(NARROW_WIDGET_KEY, (tui, theme) => {
		const component = new OverviewOverlayComponent(tui, theme, overview, fallbackTitle, presentation.renderOptions);
		overlayState = { overlayId, sessionId, ctx, layoutKey, mode: "widget", component, overview, fallbackTitle, presentation };
		overlayState.resizeListener = attachResizeListener(sessionId, overlayId);
		return component;
	}, presentation.widgetOptions);
}

export function ensureOverviewOverlay(ctx: OverviewContext, overview?: SessionOverview, fallbackTitle?: string): void {
	if (!ctx.hasUI) return;
	const sessionId = ctx.sessionManager.getSessionId();
	const layoutKey = getLayoutKey();
	const presentation = resolvePresentation(process.stdout.columns, process.stdout.rows);
	if (overlayState && (overlayState.sessionId !== sessionId || overlayState.layoutKey !== layoutKey || overlayState.mode !== presentation.mode)) hideOverviewOverlay();
	if (overlayState) return updateExistingOverlay(presentation, overview, fallbackTitle);
	const overlayId = ++nextOverlayId;
	if (presentation.mode === "widget") return showOverviewWidget(ctx, overlayId, sessionId, layoutKey, presentation, overview, fallbackTitle);
	void ctx.ui.custom<void>((tui, theme) => {
		const component = new OverviewOverlayComponent(tui, theme, overview, fallbackTitle, presentation.renderOptions);
		overlayState = { overlayId, sessionId, ctx, layoutKey, mode: presentation.mode, component, overview, fallbackTitle, presentation };
		overlayState.resizeListener = attachResizeListener(sessionId, overlayId);
		return component;
	}, { overlay: true, overlayOptions: getOverviewOverlayOptions(process.stdout.columns), onHandle: (handle) => {
		if (overlayState?.overlayId === overlayId) overlayState.handle = handle;
	} }).catch(() => {
		if (overlayState?.overlayId === overlayId) hideOverviewOverlay();
	});
}

export function clearOverlayState(): void { hideOverviewOverlay(); }
