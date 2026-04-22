import type { WorkingIndicatorOptions } from "@mariozechner/pi-coding-agent";
import { colorizeRgb } from "./ansi.js";

const CLAUDE_ORANGE: [number, number, number] = [215, 119, 87];
const CLAUDE_ORANGE_SOFT: [number, number, number] = [235, 159, 127];
const CLAUDE_BLUE: [number, number, number] = [177, 185, 249];

export const WORKING_INDICATOR: WorkingIndicatorOptions = {
	frames: [
		colorizeRgb("✻", CLAUDE_ORANGE),
		colorizeRgb("✦", CLAUDE_BLUE),
		colorizeRgb("●", CLAUDE_ORANGE_SOFT),
		colorizeRgb("✦", CLAUDE_BLUE),
	],
	intervalMs: 110,
};
