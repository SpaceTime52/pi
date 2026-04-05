import type { ExtensionContext } from "@mariozechner/pi-coding-agent";

const state = {
  pinnedHookSessionId: null as string | null,
};

const stopHookActiveBySession = new Map<string, boolean>();
const parseErrorNotified = new Set<string>();

export function getSessionId(ctx: ExtensionContext): string {
  try {
    const id = ctx.sessionManager.getSessionId();
    return id || "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Pinned session ID for CC hook payloads.
 *
 * Pi's sessionManager.getSessionId() can change mid-session (e.g. fork,
 * navigateTree, or internal resets). CC hooks use session_id as the filename,
 * so an unstable ID creates a new file per turn instead of accumulating
 * within a single session file.
 *
 * We pin the ID on the first event and only reset on session_start
 * or session_shutdown.
 */
export function getHookSessionId(ctx: ExtensionContext): string {
  if (!state.pinnedHookSessionId) {
    state.pinnedHookSessionId = getSessionId(ctx);
  }
  return state.pinnedHookSessionId;
}

export function pinHookSessionId(id: string): void {
  state.pinnedHookSessionId = id;
}

export function resetHookSessionId(): void {
  state.pinnedHookSessionId = null;
}

export function getStopHookActive(sessionId: string): boolean {
  return stopHookActiveBySession.get(sessionId) || false;
}

export function setStopHookActive(sessionId: string, value: boolean): void {
  stopHookActiveBySession.set(sessionId, value);
}

export function clearStopHookActive(): void {
  stopHookActiveBySession.clear();
}

export function markParseErrorNotified(path: string): boolean {
  if (parseErrorNotified.has(path)) return false;
  parseErrorNotified.add(path);
  return true;
}
