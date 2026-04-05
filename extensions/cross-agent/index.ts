import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { collectGroups } from "./core/collect.js";
import { registerDiscoveredCommands } from "./core/register.js";

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    const groups = collectGroups(ctx.cwd);
    registerDiscoveredCommands(pi, groups);
  });
}
