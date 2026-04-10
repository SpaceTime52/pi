import { vi } from "vitest";
import type { OverlayHandle, OverlayOptions } from "@mariozechner/pi-tui";
import type { OverviewContext, OverviewEntry, OverviewRuntime } from "../src/handlers.js";

type OverlayFactory = Parameters<OverviewContext["ui"]["custom"]>[0];
type WidgetFactory = Exclude<Parameters<OverviewContext["ui"]["setWidget"]>[1], undefined>;

export type StubRuntime = OverviewRuntime & { getSessionName: ReturnType<typeof vi.fn>; setSessionName: ReturnType<typeof vi.fn>; appendEntry: ReturnType<typeof vi.fn> };
export interface StubOverlayState {
	component?: { render(width: number): string[] };
	handle: OverlayHandle;
	options?: { overlay?: boolean; overlayOptions?: OverlayOptions; onHandle?: (handle: OverlayHandle) => void };
	tui: { requestRender: ReturnType<typeof vi.fn> };
	theme: { fg: ReturnType<typeof vi.fn> };
}
export interface StubWidgetState {
	component?: { render(width: number): string[] };
	options?: { placement?: "belowEditor" };
	tui: { requestRender: ReturnType<typeof vi.fn> };
	theme: { fg: ReturnType<typeof vi.fn> };
}
export type StubContext = OverviewContext & {
	ui: { setTitle: ReturnType<typeof vi.fn>; setWidget: ReturnType<typeof vi.fn>; custom: ReturnType<typeof vi.fn> };
	sessionManager: { getSessionId: ReturnType<typeof vi.fn>; getSessionName: ReturnType<typeof vi.fn>; getBranch: ReturnType<typeof vi.fn> };
	overlay: StubOverlayState;
	widget: StubWidgetState;
};

export function stubRuntime(currentName?: string): StubRuntime {
	return { getSessionName: vi.fn(() => currentName), setSessionName: vi.fn(), appendEntry: vi.fn() };
}

export function attachOverlay(overlay: StubOverlayState, factory: OverlayFactory, options?: StubOverlayState["options"]): Promise<void> {
	overlay.options = options;
	overlay.component = factory(overlay.tui, overlay.theme, {}, vi.fn());
	options?.onHandle?.(overlay.handle);
	return Promise.resolve();
}

export function attachWidget(widget: StubWidgetState, factory: WidgetFactory, options?: StubWidgetState["options"]): void {
	widget.options = options;
	widget.component = factory(widget.tui, widget.theme);
}

export function stubContext(branch: OverviewEntry[] = [], overrides: Partial<StubContext> = {}): StubContext {
	const overlay: StubOverlayState = {
		handle: { hide: vi.fn(), setHidden: vi.fn(), isHidden: vi.fn(() => false), focus: vi.fn(), unfocus: vi.fn(), isFocused: vi.fn(() => false) },
		tui: { requestRender: vi.fn() },
		theme: { fg: vi.fn((_color: string, text: string) => text) },
	};
	const widget: StubWidgetState = { tui: { requestRender: vi.fn() }, theme: { fg: vi.fn((_color: string, text: string) => text) } };
	const custom = vi.fn((factory, options) => attachOverlay(overlay, factory, options));
	const setWidget = vi.fn((key, content, options) => {
		if (key !== "auto-session-title.narrow") return;
		if (!content) { widget.component = undefined; widget.options = options; return; }
		attachWidget(widget, content, options);
	});
	return {
		hasUI: true,
		model: undefined,
		modelRegistry: { getApiKeyAndHeaders: vi.fn(async () => ({ ok: false, error: "no auth" })) },
		ui: { setTitle: vi.fn(), setWidget, custom },
		sessionManager: { getSessionId: vi.fn(() => "session-1"), getSessionName: vi.fn(() => undefined), getBranch: vi.fn(() => branch) },
		hasPendingMessages: vi.fn(() => false),
		overlay,
		widget,
		...overrides,
	};
}
