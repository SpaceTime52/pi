import type { AgentEndEvent, ExtensionAPI, ExtensionHandler, SessionShutdownEvent, SessionStartEvent, SessionTreeEvent } from "@mariozechner/pi-coding-agent";
import { createAgentEndHandler } from "./hooks.js";
import { createSessionShutdownHandler } from "./hooks.js";
import { createSessionStartHandler } from "./hooks.js";
import { createSessionTreeHandler } from "./hooks.js";

export default function (pi: ExtensionAPI) {
	pi.on("session_start", createSessionStartHandler(() => pi.getSessionName(), (name: string) => pi.setSessionName(name), <T>(customType: string, data?: T) => pi.appendEntry(customType, data)) as ExtensionHandler<SessionStartEvent>);
	pi.on("session_tree", createSessionTreeHandler(() => pi.getSessionName(), (name: string) => pi.setSessionName(name), <T>(customType: string, data?: T) => pi.appendEntry(customType, data)) as ExtensionHandler<SessionTreeEvent>);
	pi.on("agent_end", createAgentEndHandler(() => pi.getSessionName(), (name: string) => pi.setSessionName(name), <T>(customType: string, data?: T) => pi.appendEntry(customType, data)) as ExtensionHandler<AgentEndEvent>);
	pi.on("session_shutdown", createSessionShutdownHandler() as ExtensionHandler<SessionShutdownEvent>);
}
