import {
  DEFAULT_HOOK_TIMEOUT_MS,
  type HookDecision,
  type HookExecResult,
  type JsonRecord,
} from "./types.js";

/**
 * Convert Claude Code hook timeout (seconds) to milliseconds.
 * Official docs: "Seconds before canceling. Defaults: 600 for command"
 */
export function convertHookTimeoutToMs(timeoutSeconds: number | undefined): number {
  if (typeof timeoutSeconds === "number" && Number.isFinite(timeoutSeconds) && timeoutSeconds > 0) {
    return timeoutSeconds * 1000;
  }
  return DEFAULT_HOOK_TIMEOUT_MS;
}

export function parseJsonFromStdout(stdout: string): unknown | null {
  const trimmed = stdout.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    // pass
  }

  const lines = trimmed
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i];
    if (line === undefined) continue;
    try {
      return JSON.parse(line);
    } catch {
      // pass
    }
  }

  return null;
}

export function fallbackReason(stderr: string, stdout: string): string | undefined {
  const text = stderr.trim() || stdout.trim();
  if (!text) return undefined;
  return text.length > 2000 ? `${text.slice(0, 2000)}...` : text;
}

function pickString(obj: JsonRecord | undefined, key: string): string | undefined {
  if (!obj) return undefined;
  const value = obj[key];
  return typeof value === "string" ? value : undefined;
}

export function extractDecision(result: HookExecResult): HookDecision {
  const payload = result.json;
  const asObj = payload && typeof payload === "object" ? (payload as JsonRecord) : undefined;
  const hookSpecific = asObj?.hookSpecificOutput;
  const hookSpecificObj =
    hookSpecific && typeof hookSpecific === "object" ? (hookSpecific as JsonRecord) : undefined;

  const decisionRaw =
    pickString(hookSpecificObj, "permissionDecision") ||
    pickString(asObj, "permissionDecision") ||
    pickString(hookSpecificObj, "decision") ||
    pickString(asObj, "decision") ||
    "";

  const reason =
    pickString(hookSpecificObj, "permissionDecisionReason") ||
    pickString(asObj, "permissionDecisionReason") ||
    pickString(hookSpecificObj, "reason") ||
    pickString(asObj, "reason") ||
    fallbackReason(result.stderr, result.stdout);

  const decision = decisionRaw.toLowerCase();
  const decisionResult: HookDecision =
    decision === "allow"
      ? { action: "allow" }
      : decision === "ask"
        ? { action: "ask" }
        : decision === "deny" || decision === "block"
          ? { action: "block" }
          : result.code === 2
            ? { action: "block", reason: reason || "Hook requested block (exit code 2)." }
            : { action: "none" };

  if (decisionResult.reason === undefined && reason !== undefined) {
    return { ...decisionResult, reason };
  }
  return decisionResult;
}

export function toBlockReason(reason: string | undefined, fallback: string): string {
  const text = (reason || "").trim();
  if (!text) return fallback;
  if (text.length <= 2000) return text;
  return `${text.slice(0, 2000)}...`;
}
