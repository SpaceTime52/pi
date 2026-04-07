import path from "node:path";
import { deriveSessionTitle } from "./title.js";

export interface SessionTitleInput {
	source: "interactive" | "rpc" | "extension";
	text: string;
}

export interface SessionTitleRuntime {
	getSessionName(): string | undefined;
	setSessionName(name: string): void;
}

export interface SessionTitleContext {
	hasUI: boolean;
	cwd: string;
	ui: { setTitle(title: string): void };
	sessionManager: {
		getSessionName(): string | undefined;
		getEntries(): Array<{ type: string; message?: { role?: string } }>;
		getCwd(): string;
	};
}

function hasUserMessages(ctx: SessionTitleContext): boolean {
	return ctx.sessionManager.getEntries().some((entry) => entry.type === "message" && entry.message?.role === "user");
}

export function buildTerminalTitle(cwd: string, sessionName: string): string {
	const cwdBasename = path.basename(cwd) || cwd;
	return `π - ${sessionName} - ${cwdBasename}`;
}

export async function handleInput(
	runtime: SessionTitleRuntime,
	event: SessionTitleInput,
	ctx: SessionTitleContext,
): Promise<void> {
	if (event.source === "extension") return;
	if (runtime.getSessionName() || ctx.sessionManager.getSessionName()) return;
	if (hasUserMessages(ctx)) return;

	const title = deriveSessionTitle(event.text);
	if (!title) return;

	runtime.setSessionName(title);
	if (ctx.hasUI) ctx.ui.setTitle(buildTerminalTitle(ctx.cwd || ctx.sessionManager.getCwd(), title));
}
