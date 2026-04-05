import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { markParseErrorNotified } from "./session.js";
import { countHooks } from "./settings.js";
import {
  type ClaudeSettings,
  type HookExecResult,
  type LoadedSettings,
  SETTINGS_REL_PATH,
} from "./types.js";

function trimHookOutput(text: string): string {
  return text.length > 1200 ? `${text.slice(0, 1200)}...` : text;
}

export function notifyOnceForParseError(ctx: ExtensionContext, loaded: LoadedSettings): void {
  if (!loaded.parseError) return;
  if (!ctx.hasUI) return;
  if (!markParseErrorNotified(loaded.path)) return;
  ctx.ui.notify(`[claude-hooks-bridge] ${loaded.parseError}`, "warning");
}

export function notifyHookCount(ctx: ExtensionContext, settings: ClaudeSettings | null): void {
  if (!settings || !ctx.hasUI) return;
  const total = countHooks(settings);
  if (total > 0) {
    ctx.ui.notify(
      `[claude-hooks-bridge] loaded ${total} hook(s) from ${SETTINGS_REL_PATH}`,
      "info",
    );
  }
}

export function notifySessionStartHookResult(ctx: ExtensionContext, result: HookExecResult): void {
  if (!ctx.hasUI) return;
  const out = result.stdout.trim();
  const err = result.stderr.trim();
  if (out) {
    ctx.ui.notify(`[claude-hooks-bridge:SessionStart]\n${trimHookOutput(out)}`, "info");
  }
  if (err) {
    ctx.ui.notify(`[claude-hooks-bridge:SessionStart stderr]\n${trimHookOutput(err)}`, "warning");
  }
}
