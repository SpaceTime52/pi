import type { WorkingIndicatorOptions } from "@mariozechner/pi-coding-agent";

const DIM = "\x1b[90m";
const RESET = "\x1b[39m";

export const WORKING_INDICATOR: WorkingIndicatorOptions = {
	frames: [`${DIM}·${RESET}`, `${DIM}•${RESET}`, `${DIM}●${RESET}`, `${DIM}•${RESET}`],
	intervalMs: 140,
};
