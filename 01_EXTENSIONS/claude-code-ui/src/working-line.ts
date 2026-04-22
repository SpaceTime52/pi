import type { AgentEndEvent, AgentStartEvent, ExtensionContext, SessionShutdownEvent } from "@mariozechner/pi-coding-agent";
import { formatElapsed, formatWorkingLine, pickWorkingPhrase } from "./working-line-format.js";

let activeCtx: ExtensionContext | undefined;
let startedAt = 0;
let suffix: string | undefined;
let timer: ReturnType<typeof setInterval> | undefined;

type ToolEvent = { toolName: string };

type MessageEvent = { assistantMessageEvent: { type: string } };

function toolLabel(toolName: string) {
	return { bash: "Running bash", read: "Reading file", write: "Writing file", edit: "Editing file" }[toolName] ?? `Running ${toolName}`;
}

function currentLabel() {
	return suffix ?? pickWorkingPhrase(() => 0);
}

function renderWorkingLine() {
	activeCtx?.ui.setWorkingMessage(formatWorkingLine([currentLabel(), formatElapsed(Date.now() - startedAt)]));
}

function resetWorkingLine(ctx?: ExtensionContext) {
	if (timer) clearInterval(timer);
	timer = undefined;
	startedAt = 0;
	suffix = undefined;
	(activeCtx ?? ctx)?.ui.setWorkingMessage();
	activeCtx = undefined;
}

export function onAgentStart(_event: AgentStartEvent, ctx: ExtensionContext) {
	if (!ctx.hasUI) return;
	resetWorkingLine();
	activeCtx = ctx;
	startedAt = Date.now();
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

export function onMessageUpdate(_event: MessageEvent) {
	if (!activeCtx) return;
	renderWorkingLine();
}

export function onAgentEnd(_event: AgentEndEvent, ctx: ExtensionContext) {
	resetWorkingLine(ctx);
}

export function onSessionShutdown(_event: SessionShutdownEvent, ctx: ExtensionContext) {
	resetWorkingLine(ctx);
}
