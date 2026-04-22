import type { WorkingIndicatorOptions } from "@mariozechner/pi-coding-agent";

const ACCENT = "\x1b[38;2;215;119;87m";
const RESET = "\x1b[39m";
const FRAMES = ["·", "✻", "✽", "✶", "✳", "✢"];

export const WORKING_INDICATOR: WorkingIndicatorOptions = {
	frames: FRAMES.map((frame) => `${ACCENT}${frame}${RESET}`),
	intervalMs: 120,
};
