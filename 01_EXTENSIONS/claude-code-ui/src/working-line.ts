import type { AgentEndEvent, AgentStartEvent, ExtensionContext, SessionShutdownEvent } from "@mariozechner/pi-coding-agent";
import { formatElapsed, formatWorkingLine } from "./working-line-format.js";

type ToolEvent = { toolName: string };
type MessageEvent = { assistantMessageEvent: { type: string } };

let activeCtx: Pick<ExtensionContext, "ui"> | undefined;
let activeTool: string | undefined;
let hasVisibleOutput = false;
let startedAt = 0;
let timer: ReturnType<typeof setInterval> | undefined;

function toolLabel(toolName: string) {
	return { bash: "Running bash", read: "Reading file", write: "Writing file", edit: "Editing file" }[toolName] ?? `Running ${toolName}`;
}

function renderWorkingLine() {
	if (activeTool) return activeCtx?.ui.setWorkingMessage(formatWorkingLine([toolLabel(activeTool), formatElapsed(Date.now() - startedAt)]));
	if (hasVisibleOutput || !startedAt) return activeCtx?.ui.setWorkingMessage("");
	activeCtx?.ui.setWorkingMessage(formatWorkingLine(["Working", formatElapsed(Date.now() - startedAt)]));
}

function resetWorkingLine(ctx?: ExtensionContext) {
	if (timer) clearInterval(timer);
	timer = undefined;
	startedAt = 0;
	activeTool = undefined;
	hasVisibleOutput = false;
	(activeCtx ?? ctx)?.ui.setWorkingMessage("");
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
	activeTool = event.toolName;
	renderWorkingLine();
}

export function onToolExecutionEnd(_event: object) {
	if (!activeCtx) return;
	activeTool = undefined;
	renderWorkingLine();
}

export function onMessageUpdate(event: MessageEvent) {
	if (!activeCtx) return;
	if (event.assistantMessageEvent.type.startsWith("text_")) hasVisibleOutput = true;
	renderWorkingLine();
}

export function onAgentEnd(_event: AgentEndEvent, ctx: ExtensionContext) { resetWorkingLine(ctx); }
export function onSessionShutdown(_event: SessionShutdownEvent, ctx: ExtensionContext) { resetWorkingLine(ctx); }
