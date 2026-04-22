import { SETTINGS_REL_PATH } from "./constants.js";
import { trimHookOutput } from "./text.js";
import { shouldNotifyParseError } from "./session-state.js";
import type { ClaudeSettings, HookExecResult, LoadedSettings, RuntimeContextLike } from "./types.js";

export function notifyOnceForParseError(ctx: RuntimeContextLike, loaded: LoadedSettings): void {
  if (!loaded.parseError || !ctx.hasUI || !shouldNotifyParseError(loaded.path)) return;
  ctx.ui.notify(`[claude-hooks-bridge] ${loaded.parseError}`, "warning");
}
export function countHooks(settings: ClaudeSettings): number {
  let total = 0;
  if (!settings.hooks) return total;
  for (const groups of Object.values(settings.hooks)) {
    if (!Array.isArray(groups)) continue;
    for (const group of groups) {
      if (!Array.isArray(group.hooks)) continue;
      total += group.hooks.filter((hook) => hook?.type === "command" && typeof hook.command === "string").length;
    }
  }
  return total;
}
export function notifyHookCount(ctx: RuntimeContextLike, settings: ClaudeSettings | null): void {
  if (settings && ctx.hasUI && countHooks(settings) > 0) {
    ctx.ui.notify(`[claude-hooks-bridge] loaded ${countHooks(settings)} hook(s) from ${SETTINGS_REL_PATH}`, "info");
  }
}
export function notifySessionStartHookResult(ctx: RuntimeContextLike, result: HookExecResult): void {
  if (!ctx.hasUI) return;
  const out = result.stdout.trim();
  const err = result.stderr.trim();
  if (out) ctx.ui.notify(`[claude-hooks-bridge:SessionStart]\n${trimHookOutput(out)}`, "info");
  if (err) ctx.ui.notify(`[claude-hooks-bridge:SessionStart stderr]\n${trimHookOutput(err)}`, "warning");
}
