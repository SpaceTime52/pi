import { spawn } from "node:child_process";
import { DEFAULT_HOOK_TIMEOUT_MS } from "./constants.js";
import { getCommandHooks } from "./matching.js";
import { parseJsonFromStdout } from "./text.js";
import type { ClaudeHookEventName, ClaudeSettings, HookExecResult, JsonRecord, RuntimeContextLike } from "./types.js";

export function convertHookTimeoutToMs(timeoutSeconds: number | undefined): number {
  return typeof timeoutSeconds === "number" && Number.isFinite(timeoutSeconds) && timeoutSeconds > 0 ? timeoutSeconds * 1000 : DEFAULT_HOOK_TIMEOUT_MS;
}
export async function execCommandHook(command: string, cwd: string, payload: JsonRecord, timeoutMs: number): Promise<HookExecResult> {
  return new Promise((resolve) => {
    const child = spawn("bash", ["-lc", command], { cwd, env: { ...process.env, CLAUDE_PROJECT_DIR: cwd, PWD: cwd }, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "", stderr = "", settled = false, timedOut = false;
    const finish = (code: number) => { if (!settled) { settled = true; resolve({ command, code, stdout, stderr, timedOut, json: parseJsonFromStdout(stdout) }); } };
    const timer = Number.isFinite(timeoutMs) && timeoutMs > 0 ? setTimeout(() => { timedOut = true; child.kill("SIGTERM"); setTimeout(() => child.kill("SIGKILL"), 1000); }, timeoutMs) : undefined;
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", (error) => { if (timer) clearTimeout(timer); stderr += `\n${error instanceof Error ? error.message : String(error)}`; finish(1); });
    child.on("close", (code) => { if (timer) clearTimeout(timer); finish(typeof code === "number" ? code : 1); });
    try { child.stdin.write(`${JSON.stringify(payload)}\n`); child.stdin.end(); }
    catch (error) { stderr += `\nstdin write failed: ${error instanceof Error ? error.message : String(error)}`; finish(1); }
  });
}
export async function runHooks(settings: ClaudeSettings | null, eventName: ClaudeHookEventName, ctx: RuntimeContextLike, payload: JsonRecord, toolName?: string): Promise<HookExecResult[]> {
  const hooks = getCommandHooks(settings, eventName, toolName);
  const results: HookExecResult[] = [];
  for (const hook of hooks) results.push(await execCommandHook(hook.command as string, ctx.cwd, payload, convertHookTimeoutToMs(hook.timeout)));
  return results;
}
