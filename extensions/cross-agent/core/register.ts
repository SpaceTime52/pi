import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { expandArgs } from "./frontmatter.js";
import type { SourceGroup } from "./types.js";

const MAX_DESCRIPTION_LENGTH = 120;

export function registerDiscoveredCommands(pi: ExtensionAPI, groups: SourceGroup[]): void {
  const seen = new Set<string>();
  for (const group of groups) {
    for (const cmd of group.commands) {
      if (seen.has(cmd.name)) continue;
      seen.add(cmd.name);
      const description = `[${group.source}] ${cmd.description}`.slice(0, MAX_DESCRIPTION_LENGTH);
      const template = cmd.content;
      pi.registerCommand(cmd.name, {
        description,
        handler: async (args) => {
          pi.sendUserMessage(expandArgs(template, args || ""));
        },
      });
    }
  }
}
