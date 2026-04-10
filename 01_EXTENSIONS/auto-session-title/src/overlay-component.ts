import type { Component, OverlayOptions } from "@mariozechner/pi-tui";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import { OVERVIEW_OVERLAY_WIDTH } from "./overview-constants.js";
import { buildOverviewBodyLines } from "./overview-entry.js";
import type { OverlayTheme, OverlayTui, SessionOverview } from "./overview-types.js";

export class OverviewOverlayComponent implements Component {
	private cachedWidth?: number;
	private cachedLines?: string[];

	constructor(private tui: OverlayTui, private theme: OverlayTheme, private overview?: SessionOverview, private fallbackTitle?: string) {}

	setContent(overview?: SessionOverview, fallbackTitle?: string): void {
		this.overview = overview;
		this.fallbackTitle = fallbackTitle;
		this.invalidate();
		this.tui.requestRender();
	}

	render(width: number): string[] {
		if (this.cachedLines) {
			if (this.cachedWidth === width) return this.cachedLines;
		}
		const innerWidth = Math.max(1, width - 2);
		const border = (text: string) => this.theme.fg("border", text);
		const pad = (text: string) => {
			const clipped = truncateToWidth(text, innerWidth, "...", true);
			return clipped + " ".repeat(Math.max(0, innerWidth - visibleWidth(clipped)));
		};
		const header = this.theme.fg("accent", " 세션 ");
		const left = "─".repeat(Math.max(0, Math.floor((innerWidth - visibleWidth(header)) / 2)));
		const right = "─".repeat(Math.max(0, innerWidth - visibleWidth(header) - left.length));
		const body = buildOverviewBodyLines(this.overview, this.fallbackTitle);
		this.cachedLines = [
			border(`╭${left}`) + header + border(`${right}╮`),
			...body.map((line) => border("│") + pad(line) + border("│")),
			border(`╰${"─".repeat(innerWidth)}╯`),
		];
		this.cachedWidth = width;
		return this.cachedLines;
	}

	invalidate(): void {
		this.cachedWidth = undefined;
		this.cachedLines = undefined;
	}
}

export function getOverviewOverlayOptions(): OverlayOptions {
	return {
		anchor: "top-right",
		width: OVERVIEW_OVERLAY_WIDTH,
		minWidth: 30,
		maxHeight: 8,
		margin: { top: 1, right: 1 },
		nonCapturing: true,
		visible: (termWidth: number) => termWidth >= 100,
	};
}
