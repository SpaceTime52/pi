import { BUILTIN_TOOL_ALIASES } from "./constants.js";
import type { ClaudeCommandHook, ClaudeHookEventName, ClaudeHookGroup, ClaudeSettings } from "./types.js";

export function getHookGroups(settings: ClaudeSettings | null, eventName: ClaudeHookEventName): ClaudeHookGroup[] {
  if (!settings?.hooks) return [];
  const groups = settings.hooks[eventName];
  return Array.isArray(groups) ? groups : [];
}
export function getClaudeToolName(toolName: string): string {
  return BUILTIN_TOOL_ALIASES[toolName] || toolName;
}
export function getMatcherCandidates(toolName: string): string[] {
  const canonical = getClaudeToolName(toolName);
  return Array.from(new Set([toolName, toolName.toLowerCase(), canonical, canonical.toLowerCase()]));
}
export function matcherMatches(matcher: string | undefined, toolName: string): boolean {
  if (!matcher || matcher.trim() === "" || matcher === "*") return true;
  const candidates = getMatcherCandidates(toolName);
  try {
    const re = new RegExp(`^(?:${matcher})$`);
    if (candidates.some((name) => re.test(name))) return true;
  } catch {}
  const tokens = matcher.split("|").map((token) => token.trim()).filter(Boolean);
  return tokens.some((token) => candidates.some((name) => name.toLowerCase() === token.toLowerCase()));
}
export function getCommandHooks(settings: ClaudeSettings | null, eventName: ClaudeHookEventName, toolName?: string): ClaudeCommandHook[] {
  const hooks: ClaudeCommandHook[] = [];
  for (const group of getHookGroups(settings, eventName)) {
    if (toolName && !matcherMatches(group.matcher, toolName)) continue;
    if (!Array.isArray(group.hooks)) continue;
    for (const hook of group.hooks) {
      if (hook?.type === "command" && typeof hook.command === "string" && hook.command.trim() !== "") hooks.push(hook);
    }
  }
  return hooks;
}
