import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { buildReadyNotification, notify } from "./notify.js";

export default function (pi: ExtensionAPI) {
	pi.on("agent_end", async (_event, ctx) => notify(buildReadyNotification(ctx.sessionManager.getSessionName()).title, buildReadyNotification(ctx.sessionManager.getSessionName()).body));
}
