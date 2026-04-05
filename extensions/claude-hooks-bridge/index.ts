import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
  handlePostToolUse,
  handlePreToolUse,
  handleSessionShutdown,
  handleSessionStart,
  handleStop,
  handleUserPromptSubmit,
} from "./core/handlers.js";

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (event, ctx) => {
    await handleSessionStart(event, ctx);
  });

  pi.on("session_shutdown", async () => {
    handleSessionShutdown();
  });

  pi.on("before_agent_start", async (event, ctx) => {
    await handleUserPromptSubmit(event, ctx);
  });

  pi.on("tool_call", async (event, ctx) => {
    return handlePreToolUse(event, ctx);
  });

  pi.on("tool_result", async (event, ctx) => {
    await handlePostToolUse(event, ctx);
  });

  pi.on("agent_end", async (_event, ctx) => {
    await handleStop(pi, ctx);
  });
}
