import * as os from "node:os";
import * as path from "node:path";
import type { HeaderContext } from "./header-types.js";

export function getProjectName(ctx: HeaderContext) {
	return path.basename(ctx.cwd) || ctx.cwd;
}

export function getDisplayName() {
	const raw = process.env.PI_DISPLAY_NAME ?? process.env.CLAUDE_CODE_USER ?? process.env.USER ?? process.env.LOGNAME ?? "there";
	return raw
		.trim()
		.replace(/[._-]+/g, " ")
		.replace(/\b\w/g, (char) => char.toUpperCase()) || "there";
}

export function isHomeDirectory(cwd: string) {
	return path.resolve(cwd) === path.resolve(os.homedir());
}

export function getEntryCount(ctx: HeaderContext) {
	try {
		return ctx.sessionManager.getEntries().length;
	} catch {
		return 0;
	}
}

export function shortenPath(value: string, maxWidth: number) {
	const home = os.homedir();
	const normalized = value.startsWith(home) ? `~${value.slice(home.length)}` : value;
	return shortenMiddle(normalized, maxWidth);
}

export function shortenMiddle(value: string, maxWidth: number) {
	if (value.length <= maxWidth) return value;
	if (maxWidth <= 1) return "…";
	const head = Math.max(1, Math.ceil((maxWidth - 1) * 0.6));
	const tail = Math.max(0, maxWidth - head - 1);
	const suffix = value.slice(Math.max(0, value.length - tail));
	return `${value.slice(0, head)}…${suffix}`;
}
