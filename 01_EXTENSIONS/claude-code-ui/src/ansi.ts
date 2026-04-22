const ANSI_RESET_FG = "\x1b[39m";
const ANSI_RE = /\x1b\[[0-9;]*m/g;

export function colorizeRgb(text: string, rgb: [number, number, number]) {
	const [r, g, b] = rgb;
	return `\x1b[38;2;${r};${g};${b}m${text}${ANSI_RESET_FG}`;
}

export function stripAnsi(text: string) {
	return text.replace(ANSI_RE, "");
}
