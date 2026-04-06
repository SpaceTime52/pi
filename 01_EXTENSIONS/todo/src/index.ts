import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { restoreFromEntries, buildEntry } from "./state.js";
import { todoTool } from "./tool.js";

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		restoreFromEntries(ctx.sessionManager.getBranch());
	});
	pi.on("session_tree", async (_event, ctx) => {
		restoreFromEntries(ctx.sessionManager.getBranch());
	});
	pi.on("agent_end", async () => {
		pi.appendEntry("todo-state", buildEntry());
	});
	pi.registerTool(todoTool);
}
