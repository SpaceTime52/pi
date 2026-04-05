import type {
  ExtensionAPI,
  ExtensionContext,
  ToolCallEvent,
  ToolCallEventResult,
  ToolResultEvent,
} from "@mariozechner/pi-coding-agent";
import { extractDecision, toBlockReason } from "./decision.js";
import {
  notifyHookCount,
  notifyOnceForParseError,
  notifySessionStartHookResult,
} from "./notify.js";
import {
  buildPostToolUsePayload,
  buildPreToolUsePayload,
  makeBasePayload,
  runHooks,
} from "./runner.js";
import {
  clearStopHookActive,
  getSessionId,
  getStopHookActive,
  pinHookSessionId,
  resetHookSessionId,
  setStopHookActive,
} from "./session.js";
import { loadSettings } from "./settings.js";
import { createTranscriptFile, getLastAssistantMessage } from "./transcript.js";
import type { JsonRecord } from "./types.js";

export async function handleSessionStart(ctx: ExtensionContext): Promise<void> {
  const sessionId = getSessionId(ctx);
  pinHookSessionId(sessionId);
  setStopHookActive(sessionId, false);

  const loaded = loadSettings(ctx.cwd);
  notifyOnceForParseError(ctx, loaded);
  const settings = loaded.settings;
  notifyHookCount(ctx, settings);
  if (!settings) return;

  const results = await runHooks(
    settings,
    "SessionStart",
    ctx,
    makeBasePayload("SessionStart", ctx),
  );
  for (const result of results) {
    notifySessionStartHookResult(ctx, result);
  }
}

export function handleSessionShutdown(): void {
  resetHookSessionId();
  clearStopHookActive();
}

export async function handleUserPromptSubmit(
  event: { prompt: string },
  ctx: ExtensionContext,
): Promise<void> {
  const loaded = loadSettings(ctx.cwd);
  notifyOnceForParseError(ctx, loaded);
  const settings = loaded.settings;
  if (!settings) return;

  const payload: JsonRecord = {
    ...makeBasePayload("UserPromptSubmit", ctx),
    prompt: event.prompt,
  };
  await runHooks(settings, "UserPromptSubmit", ctx, payload);
}

export async function handlePreToolUse(
  event: ToolCallEvent,
  ctx: ExtensionContext,
): Promise<ToolCallEventResult | undefined> {
  const loaded = loadSettings(ctx.cwd);
  notifyOnceForParseError(ctx, loaded);
  const settings = loaded.settings;
  if (!settings) return undefined;

  const payload = buildPreToolUsePayload(event, ctx);
  const results = await runHooks(settings, "PreToolUse", ctx, payload, event.toolName);

  for (const result of results) {
    const decision = extractDecision(result);

    if (decision.action === "ask") {
      const reason = toBlockReason(decision.reason, "Hook requested permission.");

      if (!ctx.hasUI) {
        return { block: true, reason: `Blocked (no UI): ${reason}` };
      }

      const ok = await ctx.ui.confirm("Claude hook permission", reason, { timeout: 30_000 });
      if (!ok) {
        return {
          block: true,
          reason: toBlockReason(decision.reason, "Blocked by user confirmation from .claude hook."),
        };
      }
      continue;
    }

    if (decision.action === "block") {
      return {
        block: true,
        reason: toBlockReason(decision.reason, "Blocked by .claude PreToolUse hook."),
      };
    }
  }

  return undefined;
}

export async function handlePostToolUse(
  event: ToolResultEvent,
  ctx: ExtensionContext,
): Promise<void> {
  const loaded = loadSettings(ctx.cwd);
  notifyOnceForParseError(ctx, loaded);
  const settings = loaded.settings;
  if (!settings) return;

  const payload = buildPostToolUsePayload(event, ctx);
  await runHooks(settings, "PostToolUse", ctx, payload, event.toolName);
}

export async function handleStop(pi: ExtensionAPI, ctx: ExtensionContext): Promise<void> {
  const loaded = loadSettings(ctx.cwd);
  notifyOnceForParseError(ctx, loaded);
  const settings = loaded.settings;
  if (!settings) return;

  const sessionId = getSessionId(ctx);
  const stopHookActive = getStopHookActive(sessionId);
  const transcriptPath = createTranscriptFile(ctx, sessionId);

  const lastAssistantMessage = getLastAssistantMessage(ctx);
  const payload: JsonRecord = {
    ...makeBasePayload("Stop", ctx),
    stop_hook_active: stopHookActive,
  };
  if (transcriptPath) payload.transcript_path = transcriptPath;
  if (lastAssistantMessage) payload.last_assistant_message = lastAssistantMessage;

  const results = await runHooks(settings, "Stop", ctx, payload);

  let blockedReason: string | undefined;
  for (const result of results) {
    const decision = extractDecision(result);
    if (decision.action === "block") {
      blockedReason = toBlockReason(
        decision.reason,
        "Stop hook blocked completion. Continue the remaining work before finishing.",
      );
      break;
    }
  }

  if (!blockedReason) {
    setStopHookActive(sessionId, false);
    return;
  }

  if (!stopHookActive) {
    setStopHookActive(sessionId, true);
    pi.sendUserMessage(blockedReason, { deliverAs: "followUp" });
    if (ctx.hasUI) {
      ctx.ui.notify("[claude-hooks-bridge] Stop hook blocked end and queued follow-up.", "info");
    }
    return;
  }

  // 무한 루프 보호: 이미 stop_hook_active=true 인 상태에서 다시 block이면 자동 재시도하지 않는다.
  setStopHookActive(sessionId, false);
  if (ctx.hasUI) {
    ctx.ui.notify(
      `[claude-hooks-bridge] Stop hook blocked again (loop guard): ${blockedReason}`,
      "warning",
    );
  }
}
