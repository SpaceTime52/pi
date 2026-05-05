// Per-session visual badge so multiple panes in the same Ghostty tab are
// distinguishable when the user pins a custom emoji. Hash(seed) -> deterministic
// emoji + color.
export const BADGE_EMOJIS = [
	"🦊", "🐢", "🐧", "🦁", "🐯", "🦋", "🐙", "🦄",
	"🐝", "🐼", "🐨", "🐸", "🦜", "🦒", "🦘", "🦦",
	"🐺", "🐻", "🐰", "🦔", "🐮", "🐭", "🐹", "🐱",
	"🦝", "🦨", "🦥", "🐳", "🦓", "🐌", "🦩", "🐞",
] as const;

// 256-color codes chosen for high contrast and decent legibility on dark themes.
export const BADGE_COLORS_256 = [
	39, 45, 51, 81, 117, 75, 33, 27,
	201, 207, 213, 219, 165, 197, 161, 198,
	220, 214, 208, 202, 196, 178, 154, 118,
	82, 46, 50, 226, 215, 141, 99, 105,
] as const;

// Status-coded dot colors used when no custom badge is pinned.
export const STATUS_COLOR_WORKING = 46; // bright green
export const STATUS_COLOR_IDLE = 244; // mid gray

export type Badge = { emoji: string; color: number };

export function hashStr(s: string): number {
	let h = 5381;
	for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
	return h >>> 0;
}

export function badgeFor(seed: string): Badge {
	const h = hashStr(seed);
	return {
		emoji: BADGE_EMOJIS[h % BADGE_EMOJIS.length]!,
		color: BADGE_COLORS_256[h % BADGE_COLORS_256.length]!,
	};
}

export function colorize256(text: string, color: number): string {
	return `\x1b[38;5;${color}m${text}\x1b[39m`;
}
