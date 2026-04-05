import {
  BUILTIN_TOOL_ALIASES,
  type ClaudeCommandHook,
  type ClaudeHookEventName,
  type ClaudeHookGroup,
  type ClaudeSettings,
} from "./types.js";

export function getHookGroups(
  settings: ClaudeSettings | null,
  eventName: ClaudeHookEventName,
): ClaudeHookGroup[] {
  if (!settings?.hooks) return [];
  const groups = settings.hooks[eventName];
  if (!Array.isArray(groups)) return [];
  return groups;
}

export function getClaudeToolName(toolName: string): string {
  return BUILTIN_TOOL_ALIASES[toolName] || toolName;
}

export function getMatcherCandidates(toolName: string): string[] {
  const canonical = getClaudeToolName(toolName);
  const set = new Set<string>([
    toolName,
    toolName.toLowerCase(),
    canonical,
    canonical.toLowerCase(),
  ]);
  return Array.from(set);
}

export function matcherMatches(matcher: string | undefined, toolName: string): boolean {
  if (!matcher || matcher.trim() === "") return true;

  const candidates = getMatcherCandidates(toolName);

  try {
    const re = new RegExp(`^(?:${matcher})$`);
    if (candidates.some((name) => re.test(name))) return true;
  } catch {
    // matcher가 정규식으로 유효하지 않아도 fallback 비교를 시도한다.
  }

  const tokens = matcher
    .split("|")
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) return false;
  return tokens.some((token) =>
    candidates.some((name) => name === token || name.toLowerCase() === token.toLowerCase()),
  );
}

export function getCommandHooks(
  settings: ClaudeSettings | null,
  eventName: ClaudeHookEventName,
  toolName?: string,
): ClaudeCommandHook[] {
  const groups = getHookGroups(settings, eventName);
  const hooks: ClaudeCommandHook[] = [];

  for (const group of groups) {
    if (toolName && !matcherMatches(group.matcher, toolName)) continue;
    if (!Array.isArray(group.hooks)) continue;

    for (const hook of group.hooks) {
      if (!hook || typeof hook !== "object") continue;
      if (hook.type !== "command") continue;
      if (typeof hook.command !== "string" || hook.command.trim() === "") continue;
      hooks.push(hook);
    }
  }

  return hooks;
}
