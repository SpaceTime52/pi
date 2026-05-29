import path from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { inferActorsFromTool, unique } from "./actor-detection.js";
import { type AttributionState, formatActorList, getPlainStatusText, MAIN_AGENT } from "./format.js";

const STATUS_KEY = "agent-attribution";
const TITLE_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

function getBaseTitle(pi: ExtensionAPI, ctx: ExtensionContext): string {
	const cwdName = path.basename(ctx.cwd || process.cwd()) || "workspace";
	const sessionName = pi.getSessionName();
	return sessionName ? `π ${sessionName} · ${cwdName}` : `π ${cwdName}`;
}

function getStatusText(ctx: ExtensionContext, state: AttributionState): string {
	const theme = ctx.ui.theme;
	const plainText = getPlainStatusText(state);

	if (state.phase === "idle") return theme.fg("dim", plainText);
	if (state.phase === "done") return theme.fg("success", "✓ ") + theme.fg("dim", plainText.slice(2));
	return theme.fg("accent", `agent: ${state.actor}`) + theme.fg("dim", plainText.replace(`agent: ${state.actor}`, ""));
}

export default function (pi: ExtensionAPI) {
	let titleTimer: ReturnType<typeof setInterval> | undefined;
	let titleFrame = 0;
	let currentState: AttributionState = {
		phase: "idle",
		actor: MAIN_AGENT,
		contributors: [MAIN_AGENT],
	};
	const activeToolActors = new Map<string, string[]>();
	const turnContributors = new Set<string>([MAIN_AGENT]);

	function stopTitleAnimation(ctx: ExtensionContext, titleActor = currentState.actor): void {
		if (titleTimer) {
			clearInterval(titleTimer);
			titleTimer = undefined;
		}
		titleFrame = 0;
		if (ctx.hasUI) ctx.ui.setTitle(`${getBaseTitle(pi, ctx)} · ${titleActor}`);
	}

	function startTitleAnimation(ctx: ExtensionContext, label: string): void {
		stopTitleAnimation(ctx);
		if (!ctx.hasUI) return;
		titleTimer = setInterval(() => {
			const frame = TITLE_FRAMES[titleFrame % TITLE_FRAMES.length];
			ctx.ui.setTitle(`${frame} ${label} · ${getBaseTitle(pi, ctx)}`);
			titleFrame++;
		}, 100);
	}

	function render(ctx: ExtensionContext, nextState: AttributionState): void {
		currentState = nextState;
		if (!ctx.hasUI) return;
		ctx.ui.setStatus(STATUS_KEY, getStatusText(ctx, nextState));
	}

	function renderIdle(ctx: ExtensionContext, phase: "idle" | "done" = "idle"): void {
		const nextState: AttributionState = {
			phase,
			actor: MAIN_AGENT,
			contributors: unique([...turnContributors]),
		};
		stopTitleAnimation(ctx, nextState.actor);
		render(ctx, nextState);
	}

	pi.on("session_start", async (_event, ctx) => {
		turnContributors.clear();
		turnContributors.add(MAIN_AGENT);
		renderIdle(ctx);
	});

	pi.on("agent_start", async (_event, ctx) => {
		activeToolActors.clear();
		turnContributors.clear();
		turnContributors.add(MAIN_AGENT);
		render(ctx, {
			phase: "working",
			actor: MAIN_AGENT,
			contributors: unique([...turnContributors]),
		});
		startTitleAnimation(ctx, MAIN_AGENT);
	});

	pi.on("tool_execution_start", async (event, ctx) => {
		const actors = inferActorsFromTool(event.toolName, event.args);
		if (actors.length > 0) {
			activeToolActors.set(event.toolCallId, actors);
			for (const actor of actors) turnContributors.add(actor);
			const actorLabel = formatActorList(actors);
			render(ctx, {
				phase: "delegating",
				actor: actorLabel,
				detail: `from ${MAIN_AGENT}`,
				contributors: unique([...turnContributors]),
			});
			startTitleAnimation(ctx, actorLabel);
			return;
		}

		render(ctx, {
			phase: "using-tool",
			actor: MAIN_AGENT,
			detail: `using ${event.toolName}`,
			contributors: unique([...turnContributors]),
		});
	});

	pi.on("tool_execution_end", async (event, ctx) => {
		activeToolActors.delete(event.toolCallId);
		const remainingActors = unique([...activeToolActors.values()].flat());
		if (remainingActors.length > 0) {
			const actorLabel = formatActorList(remainingActors);
			render(ctx, {
				phase: "delegating",
				actor: actorLabel,
				detail: `from ${MAIN_AGENT}`,
				contributors: unique([...turnContributors]),
			});
			startTitleAnimation(ctx, actorLabel);
			return;
		}

		render(ctx, {
			phase: "working",
			actor: MAIN_AGENT,
			contributors: unique([...turnContributors]),
		});
		startTitleAnimation(ctx, MAIN_AGENT);
	});

	pi.on("agent_end", async (_event, ctx) => {
		renderIdle(ctx, "done");
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		stopTitleAnimation(ctx);
		if (ctx.hasUI) ctx.ui.setStatus(STATUS_KEY, undefined);
	});

	pi.registerCommand("agent-attribution", {
		description: "Show which agent is currently preparing or contributed to the current Pi turn",
		handler: async (_args, ctx) => {
			render(ctx, currentState);
			ctx.ui.notify(getPlainStatusText(currentState), "info");
		},
	});
}
