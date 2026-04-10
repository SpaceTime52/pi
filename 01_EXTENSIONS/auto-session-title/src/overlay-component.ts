import type { Component, OverlayOptions } from "@mariozechner/pi-tui";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import { OVERVIEW_OVERLAY_WIDTH } from "./overview-constants.js";
import { buildOverviewBodyLines, resolveOverviewTitle } from "./overview-entry.js";
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
		if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;
		const innerWidth = Math.max(1, width - 2);
		const border = (text: string) => this.theme.fg("border", text);
		const pad = (text: string) => {
			const clipped = truncateToWidth(text, innerWidth, "...", true);
			return clipped + " ".repeat(Math.max(0, innerWidth - visibleWidth(clipped)));
		};
		const title = truncateToWidth(` ${resolveOverviewTitle(this.overview, this.fallbackTitle)} `, innerWidth, "...", true);
		const header = this.theme.fg("accent", title);
		const headerWidth = visibleWidth(title);
		const left = "─".repeat(Math.max(0, Math.floor((innerWidth - headerWidth) / 2)));
		const right = "─".repeat(Math.max(0, innerWidth - headerWidth - left.length));
		this.cachedLines = [
			border(`╭${left}`) + header + border(`${right}╮`),
			border(`├${"─".repeat(innerWidth)}┤`),
			...buildOverviewBodyLines(this.overview).map((line) => border("│") + pad(line) + border("│")),
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
		minWidth: 48,
		maxHeight: 10,
		margin: { top: 1, right: 1 },
		nonCapturing: true,
		visible: (termWidth: number) => termWidth >= 100,
	};
}
