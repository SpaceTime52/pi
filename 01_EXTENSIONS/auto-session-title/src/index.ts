import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { createBeforeAgentStartHandler, createInputHandler, createSessionShutdownHandler } from "./hooks.js";

export default function (pi: ExtensionAPI) {
	pi.on("input", createInputHandler(() => pi.getSessionName(), (name) => pi.setSessionName(name)));
	pi.on("before_agent_start", createBeforeAgentStartHandler(() => pi.getSessionName(), (name) => pi.setSessionName(name)));
	pi.on("session_shutdown", createSessionShutdownHandler());
}
