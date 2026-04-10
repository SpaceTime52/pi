import type { Component, OverlayOptions } from "@mariozechner/pi-tui";
import { truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@mariozechner/pi-tui";
import { OVERVIEW_OVERLAY_WIDTH } from "./overview-constants.js";
import { buildOverviewBodyLines, resolveOverviewTitle } from "./overview-entry.js";
import type { OverlayTheme, OverlayTui, SessionOverview } from "./overview-types.js";

const OVERVIEW_OVERLAY_MIN_WIDTH = 60;
const OVERVIEW_OVERLAY_MAX_WIDTH = 96;
const OVERVIEW_OVERLAY_MIN_TRANSCRIPT_WIDTH = 48;
const OVERVIEW_OVERLAY_MIN_VISIBLE_WIDTH = OVERVIEW_OVERLAY_MIN_WIDTH + OVERVIEW_OVERLAY_MIN_TRANSCRIPT_WIDTH;

function resolveOverlayWidth(termWidth: number): number {
	const capped = Math.min(OVERVIEW_OVERLAY_MAX_WIDTH, Math.max(OVERVIEW_OVERLAY_MIN_WIDTH, termWidth - OVERVIEW_OVERLAY_MIN_TRANSCRIPT_WIDTH));
	return capped - (capped % 2);
}

function resolveOverlayCol(termWidth: number, width: number): number {
	const maxCol = Math.max(0, termWidth - width);
	// Keep the left edge on an even column when we can. This avoids a pi-tui
	// compositing drift that can appear when a non-capturing overlay starts in
	// the second cell of a wide CJK character from the underlying transcript.
	return maxCol - (maxCol % 2);
}

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
		const pad = (text: string) => text + " ".repeat(Math.max(0, innerWidth - visibleWidth(text)));
		const title = truncateToWidth(` ${resolveOverviewTitle(this.overview, this.fallbackTitle)} `, Math.max(1, innerWidth - 2), "...", false);
		const header = this.theme.fg("accent", title);
		const right = "─".repeat(Math.max(1, innerWidth - 1 - visibleWidth(title)));
		const body = buildOverviewBodyLines(this.overview).flatMap((line) => wrapTextWithAnsi(line, innerWidth));
		this.cachedLines = [
			border("╭─") + header + border(`${right}╮`),
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

export function getOverviewOverlayOptions(termWidth?: number): OverlayOptions {
	if (typeof termWidth === "number") {
		const width = resolveOverlayWidth(termWidth);
		return {
			row: 1,
			col: resolveOverlayCol(termWidth, width),
			width,
			minWidth: OVERVIEW_OVERLAY_MIN_WIDTH,
			nonCapturing: true,
			visible: (nextTermWidth: number) => nextTermWidth >= OVERVIEW_OVERLAY_MIN_VISIBLE_WIDTH,
		};
	}
	return {
		anchor: "top-right",
		width: OVERVIEW_OVERLAY_WIDTH,
		minWidth: OVERVIEW_OVERLAY_MIN_WIDTH,
		margin: { top: 1, right: 0 },
		nonCapturing: true,
		visible: (nextTermWidth: number) => nextTermWidth >= OVERVIEW_OVERLAY_MIN_VISIBLE_WIDTH,
	};
}
