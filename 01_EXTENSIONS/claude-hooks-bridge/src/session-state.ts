import type { RuntimeContextLike } from "./types.js";

const parseErrorNotified = new Set<string>();
const stopHookActiveBySession = new Map<string, boolean>();
let pinnedHookSessionId: string | null = null;

export function getSessionId(ctx: RuntimeContextLike): string {
  try { return ctx.sessionManager.getSessionId() || "unknown"; } catch { return "unknown"; }
}
export function getHookSessionId(ctx: RuntimeContextLike): string {
  if (!pinnedHookSessionId) pinnedHookSessionId = getSessionId(ctx);
  return pinnedHookSessionId;
}
export function resetSessionState(): void {
  pinnedHookSessionId = null;
  stopHookActiveBySession.clear();
}
export function setSessionStartState(ctx: RuntimeContextLike): string {
  pinnedHookSessionId = getSessionId(ctx);
  stopHookActiveBySession.set(pinnedHookSessionId, false);
  return pinnedHookSessionId;
}
export function getStopHookActive(sessionId: string): boolean {
  return stopHookActiveBySession.get(sessionId) || false;
}
export function setStopHookActive(sessionId: string, active: boolean): void {
  stopHookActiveBySession.set(sessionId, active);
}
export function shouldNotifyParseError(settingsPath: string): boolean {
  if (parseErrorNotified.has(settingsPath)) return false;
  parseErrorNotified.add(settingsPath);
  return true;
}
