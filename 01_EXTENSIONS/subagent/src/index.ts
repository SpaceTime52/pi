import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { createAbortTool, createBatchTool, createChainTool, createContinueTool, createDetailTool, createRunTool, createRunsTool } from "./tool.js";
import { buildRunsEntry } from "./session.js";
import { syncWidget } from "./widget.js";
import { listRuns } from "./store.js";
import { onSessionRestore } from "./dispatch.js";
import { buildSubCommand } from "./commands.js";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

export default function (pi: ExtensionAPI) {
	pi.on("session_start", onSessionRestore());
	pi.on("session_tree", onSessionRestore());
	pi.on("agent_end", async (_event, ctx) => {
		pi.appendEntry("subagent-runs", buildRunsEntry());
		syncWidget(ctx, listRuns());
	});
	pi.registerTool(createRunTool(pi, join(dirname(fileURLToPath(import.meta.url)), "..", "agents")));
	pi.registerTool(createBatchTool(pi, join(dirname(fileURLToPath(import.meta.url)), "..", "agents")));
	pi.registerTool(createChainTool(pi, join(dirname(fileURLToPath(import.meta.url)), "..", "agents")));
	pi.registerTool(createContinueTool(pi, join(dirname(fileURLToPath(import.meta.url)), "..", "agents")));
	pi.registerTool(createAbortTool(pi, join(dirname(fileURLToPath(import.meta.url)), "..", "agents")));
	pi.registerTool(createDetailTool(pi, join(dirname(fileURLToPath(import.meta.url)), "..", "agents")));
	pi.registerTool(createRunsTool(pi, join(dirname(fileURLToPath(import.meta.url)), "..", "agents")));
	pi.registerCommand("sub", buildSubCommand(join(dirname(fileURLToPath(import.meta.url)), "..", "agents"), (c, o) => pi.sendUserMessage(c, o)));
}
