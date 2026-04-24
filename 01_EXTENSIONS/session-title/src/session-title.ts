import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { extractSessionTitleContext } from "./title-context.js";
import { generateSessionTitle } from "./title-generator.js";
import { getSessionTitle, shouldAutoNameSession, shouldReplaceSessionTitle } from "./session-title-state.js";
import { clearSessionTitleUi, syncSessionTitleUi } from "./session-title-ui.js";
import type { SessionTitleApi } from "./types.js";

export default function registerSessionTitle(_pi: SessionTitleApi) {
	let namingInFlight = false;

	const maybeUpdateTitle = async (
		ctx: ExtensionContext,
		input: string,
		shouldApply: (currentTitle: string | undefined) => boolean,
	) => {
		namingInFlight = true;
		try {
			const sessionTitle = await generateSessionTitle(ctx, input);
			const currentTitle = getSessionTitle(_pi, ctx);
			if (sessionTitle && sessionTitle !== currentTitle && shouldApply(currentTitle)) {
				_pi.setSessionName(sessionTitle);
			}
		} finally {
			namingInFlight = false;
			syncSessionTitleUi(_pi, ctx);
		}
	};

	const maybeAutoNameFromPrompt = async (userPrompt: string, ctx: ExtensionContext) => {
		const context = extractSessionTitleContext(ctx.sessionManager, getSessionTitle(_pi, ctx), userPrompt);
		const firstPrompt = context.firstUserPrompt || userPrompt;
		if (!shouldAutoNameSession(_pi, ctx, firstPrompt, namingInFlight)) {
			syncSessionTitleUi(_pi, ctx);
			return;
		}
		await maybeUpdateTitle(ctx, firstPrompt, (currentTitle) => shouldReplaceSessionTitle(currentTitle, firstPrompt));
	};

	const runTitleUpdateInBackground = (ctx: ExtensionContext, task: Promise<void>) => {
		void task.catch(() => syncSessionTitleUi(_pi, ctx));
	};

	_pi.on("session_start", (_event, ctx) => syncSessionTitleUi(_pi, ctx));
	_pi.on("before_agent_start", (event, ctx) => runTitleUpdateInBackground(ctx, maybeAutoNameFromPrompt(event.prompt, ctx)));
	_pi.on("session_tree", (_event, ctx) => syncSessionTitleUi(_pi, ctx));
	_pi.on("agent_end", (_event, ctx) => syncSessionTitleUi(_pi, ctx));
	_pi.on("session_shutdown", (_event, ctx) => clearSessionTitleUi(ctx));
}
