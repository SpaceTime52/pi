import path from "node:path";
import type { HookDecision, HookExecResult, JsonRecord } from "./types.js";

export function normalizeToolInput(toolName: string, rawInput: unknown, cwd: string): JsonRecord {
  const input = rawInput && typeof rawInput === "object" ? { ...(rawInput as JsonRecord) } : {};
  const candidate = typeof input.path === "string" ? input.path : typeof input.file_path === "string" ? input.file_path : typeof input.filePath === "string" ? input.filePath : undefined;
  if (candidate) {
    const absolute = path.isAbsolute(candidate) ? path.normalize(candidate) : path.resolve(cwd, candidate);
    input.path = absolute; input.file_path = absolute; input.filePath = absolute;
  }
  if (toolName === "bash" && typeof input.command !== "string") input.command = "";
  return input;
}
export function extractTextFromBlocks(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.flatMap((block) => block && typeof block === "object" && typeof (block as JsonRecord).text === "string" ? [(block as JsonRecord).text as string] : []).join("");
}
export function parseJsonFromStdout(stdout: string): unknown | null {
  const trimmed = stdout.trim();
  if (!trimmed) return null;
  try { return JSON.parse(trimmed); } catch {}
  for (const line of trimmed.split("\n").map((line) => line.trim()).filter(Boolean).reverse()) {
    try { return JSON.parse(line); } catch {}
  }
  return null;
}
export function fallbackReason(stderr: string, stdout: string): string | undefined {
  const text = stderr.trim() || stdout.trim();
  return !text ? undefined : text.length > 2000 ? `${text.slice(0, 2000)}...` : text;
}
export function extractDecision(result: HookExecResult): HookDecision {
  const asObj = result.json && typeof result.json === "object" ? (result.json as JsonRecord) : undefined;
  const hookObj = asObj?.hookSpecificOutput && typeof asObj.hookSpecificOutput === "object" ? (asObj.hookSpecificOutput as JsonRecord) : undefined;
  const decisionRaw = (typeof hookObj?.permissionDecision === "string" && hookObj.permissionDecision) || (typeof asObj?.permissionDecision === "string" && asObj.permissionDecision) || (typeof hookObj?.decision === "string" && hookObj.decision) || (typeof asObj?.decision === "string" && asObj.decision) || "";
  const reason = (typeof hookObj?.permissionDecisionReason === "string" && hookObj.permissionDecisionReason) || (typeof asObj?.permissionDecisionReason === "string" && asObj.permissionDecisionReason) || (typeof hookObj?.reason === "string" && hookObj.reason) || (typeof asObj?.reason === "string" && asObj.reason) || fallbackReason(result.stderr, result.stdout);
  const decision = decisionRaw.toLowerCase();
  if (decision === "allow") return { action: "allow", reason };
  if (decision === "ask") return { action: "ask", reason };
  if (decision === "deny" || decision === "block") return { action: "block", reason };
  return result.code === 2 ? { action: "block", reason: reason || "Hook requested block (exit code 2)." } : { action: "none", reason };
}
export function toBlockReason(reason: string | undefined, fallback: string): string {
  const text = (reason || "").trim();
  return !text ? fallback : text.length > 2000 ? `${text.slice(0, 2000)}...` : text;
}
export function trimHookOutput(text: string): string {
  return text.length > 1200 ? `${text.slice(0, 1200)}...` : text;
}
