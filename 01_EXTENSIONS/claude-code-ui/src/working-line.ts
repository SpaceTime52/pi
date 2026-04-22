import type { AgentEndEvent, AgentStartEvent, ExtensionContext, SessionShutdownEvent } from "@mariozechner/pi-coding-agent";
import { formatElapsed, formatWorkingLine, pickWorkingPhrase } from "./working-line-format.js";

let activeCtx: ExtensionContext | undefined;
let startedAt = 0;
let phrase = "Thinking...";
let suffix: string | undefined;
let thinkingStartedAt: number | undefined;
let thoughtDurationMs: number | undefined;
let timer: ReturnType<typeof setInterval> | undefined;

type ToolEvent = { toolName: string };
type MessageEvent = { assistantMessageEvent: { type: string } };

function toolLabel(toolName: string) {
	return { bash: "running bash", read: "reading file", write: "writing file", edit: "editing file" }[toolName] ?? `running ${toolName}`;
}

function thinkingLabel() {
	if (thinkingStartedAt !== undefined) return "thinking";
	if (thoughtDurationMs !== undefined) return `thought for ${Math.max(1, Math.round(thoughtDurationMs / 1000))}s`;
}

function renderWorkingLine() {
	activeCtx?.ui.setWorkingMessage(formatWorkingLine([phrase, suffix, formatElapsed(Date.now() - startedAt), thinkingLabel()]));
}

function resetWorkingLine(ctx?: ExtensionContext) {
	if (timer) clearInterval(timer);
	timer = undefined;
	startedAt = 0;
	suffix = undefined;
	thinkingStartedAt = undefined;
	thoughtDurationMs = undefined;
	(activeCtx ?? ctx)?.ui.setWorkingMessage();
	activeCtx = undefined;
}

export function onAgentStart(_event: AgentStartEvent, ctx: ExtensionContext) {
	if (!ctx.hasUI) return;
	resetWorkingLine();
	activeCtx = ctx;
	startedAt = Date.now();
	phrase = pickWorkingPhrase();
	renderWorkingLine();
	timer = setInterval(renderWorkingLine, 1000);
}

export function onToolExecutionStart(event: ToolEvent) {
	if (!activeCtx) return;
	suffix = toolLabel(event.toolName);
	renderWorkingLine();
}

export function onToolExecutionEnd(_event: object) {
	if (!activeCtx) return;
	suffix = undefined;
	renderWorkingLine();
}

export function onMessageUpdate(event: MessageEvent) {
	if (!activeCtx) return;
	if (event.assistantMessageEvent.type === "thinking_start") thinkingStartedAt = Date.now();
	if (event.assistantMessageEvent.type === "thinking_end" && thinkingStartedAt !== undefined) {
		thoughtDurationMs = Date.now() - thinkingStartedAt;
		thinkingStartedAt = undefined;
	}
	renderWorkingLine();
}

export function onAgentEnd(_event: AgentEndEvent, ctx: ExtensionContext) {
	resetWorkingLine(ctx);
}

export function onSessionShutdown(_event: SessionShutdownEvent, ctx: ExtensionContext) {
	resetWorkingLine(ctx);
}
