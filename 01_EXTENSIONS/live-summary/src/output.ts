import { type Badge, colorize256, STATUS_COLOR_IDLE, STATUS_COLOR_WORKING } from "./badge.js";

export type OutputState = {
	cwdBasename: string;
	sessionName: string | undefined;
	cachedSummary: string;
	pinnedSummary: string | null;
	pinnedBadge: Badge | null;
	autoBadge: Badge;
	isWorking: boolean;
};

// Title is rendered by the terminal (Ghostty tab/window strip). ANSI colors
// don't apply there, so we keep the badge emoji visible for at-a-glance
// identification across panes.
export function buildTitle(state: OutputState): string {
	const summary = state.pinnedSummary ?? state.cachedSummary;
	const head = summary || state.sessionName || `π · ${state.cwdBasename}`;
	const emoji = (state.pinnedBadge ?? state.autoBadge).emoji;
	return `${emoji} ${head} · ${state.cwdBasename}`;
}

// Footer/widget line: minimum visual noise. Color encodes status, not session
// identity, except when the user has explicitly pinned a custom badge.
//   pinned summary -> 📌
//   custom badge   -> that emoji (user picked it explicitly)
//   working        -> green ●
//   idle           -> dim gray ●
export function buildStatus(state: OutputState): string {
	const summary = state.pinnedSummary ?? state.cachedSummary;
	let prefix: string;
	if (state.pinnedSummary) {
		prefix = "📌";
	} else if (state.pinnedBadge) {
		prefix = colorize256(state.pinnedBadge.emoji, state.pinnedBadge.color);
	} else {
		const color = state.isWorking ? STATUS_COLOR_WORKING : STATUS_COLOR_IDLE;
		prefix = colorize256("●", color);
	}
	return summary ? `${prefix} ${summary}` : `${prefix} …`;
}
