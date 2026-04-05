import { homedir } from "node:os";
import { join } from "node:path";
import { scanAgents, scanCommands, scanSkills } from "./scan.js";
import type { SourceGroup } from "./types.js";

const PROVIDERS = ["claude", "gemini", "codex"] as const;

export function collectGroups(cwd: string): SourceGroup[] {
  const home = homedir();
  const groups: SourceGroup[] = [];

  for (const provider of PROVIDERS) {
    const locations: Array<readonly [string, string]> = [
      [join(cwd, `.${provider}`), `.${provider}`],
      [join(home, `.${provider}`), `~/.${provider}`],
    ];
    for (const [dir, label] of locations) {
      const commands = scanCommands(join(dir, "commands"));
      const skills = scanSkills(join(dir, "skills"));
      const agents = scanAgents(join(dir, "agents"));
      if (commands.length || skills.length || agents.length) {
        groups.push({ source: label, commands, skills, agents });
      }
    }
  }

  const localAgents = scanAgents(join(cwd, ".pi", "agents"));
  if (localAgents.length) {
    groups.push({
      source: ".pi/agents",
      commands: [],
      skills: [],
      agents: localAgents,
    });
  }

  return groups;
}
