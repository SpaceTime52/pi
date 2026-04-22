import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { generateSessionTitle } from "./title-generator.js";
import { getSessionTitle, shouldAutoNameSession, shouldReplaceSessionTitle } from "./session-title-state.js";
import { clearSessionTitleUi, syncSessionTitleUi } from "./session-title-ui.js";
import type { SessionTitleApi } from "./types.js";

export default function registerSessionTitle(_pi: SessionTitleApi) {
	let namingInFlight = false;

	const maybeAutoName = async (userPrompt: string, ctx: ExtensionContext) => {
		if (!shouldAutoNameSession(_pi, ctx, userPrompt, namingInFlight)) {
			syncSessionTitleUi(_pi, ctx);
			return;
		}
		namingInFlight = true;
		try {
			const sessionTitle = await generateSessionTitle(ctx, userPrompt);
			if (sessionTitle && shouldReplaceSessionTitle(getSessionTitle(_pi, ctx), userPrompt)) {
				_pi.setSessionName(sessionTitle);
			}
		} finally {
			namingInFlight = false;
			syncSessionTitleUi(_pi, ctx);
		}
	};

	_pi.on("session_start", (_event, ctx) => syncSessionTitleUi(_pi, ctx));
	_pi.on("before_agent_start", (event, ctx) => {
		syncSessionTitleUi(_pi, ctx);
		void maybeAutoName(event.prompt, ctx);
	});
	_pi.on("session_tree", (_event, ctx) => syncSessionTitleUi(_pi, ctx));
	_pi.on("agent_end", (_event, ctx) => syncSessionTitleUi(_pi, ctx));
	_pi.on("session_shutdown", (_event, ctx) => clearSessionTitleUi(ctx));
}
