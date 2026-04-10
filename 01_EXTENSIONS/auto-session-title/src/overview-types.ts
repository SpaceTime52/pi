import type { Theme } from "@mariozechner/pi-coding-agent";
import type { Component, OverlayHandle, OverlayOptions, TUI } from "@mariozechner/pi-tui";
import type { SessionOverviewModel, SessionOverviewModelRegistry } from "./summarize.js";

export interface SessionOverview {
	title: string;
	summary: string[];
}

export interface StoredOverview extends SessionOverview {
	coveredThroughEntryId?: string;
}

export interface PersistedOverview extends SessionOverview {
	entryId: string;
	coveredThroughEntryId: string;
}

export interface OverviewRuntime {
	getSessionName(): string | undefined;
	setSessionName(name: string): void;
	appendEntry<T>(customType: string, data?: T): void;
}

export interface OverviewEntry {
	type: string;
	id: string;
	customType?: string;
	data?: object | null;
	summary?: string;
	message?: { role?: string; content?: unknown; toolName?: string };
}

export type OverlayTui = Pick<TUI, "requestRender">;
export type OverlayTheme = Pick<Theme, "fg">;
export type OverlayComponent = Component & { dispose?(): void };

export interface OverviewContext {
	hasUI: boolean;
	model: SessionOverviewModel | undefined;
	modelRegistry: SessionOverviewModelRegistry;
	ui: {
		setTitle(title: string): void;
		custom<T>(
			factory: (tui: OverlayTui, theme: OverlayTheme, keybindings: object, done: (result: T) => void) => OverlayComponent,
			options?: { overlay?: boolean; overlayOptions?: OverlayOptions; onHandle?: (handle: OverlayHandle) => void },
		): Promise<T>;
	};
	sessionManager: {
		getSessionId(): string;
		getSessionName(): string | undefined;
		getBranch(): OverviewEntry[];
	};
}
