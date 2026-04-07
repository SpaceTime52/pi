import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { createAgentEndHandler } from "./hooks.js";

export default function (pi: ExtensionAPI) {
	pi.on("agent_end", createAgentEndHandler());
}
