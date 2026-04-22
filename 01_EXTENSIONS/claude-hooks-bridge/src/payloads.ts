import { getHookSessionId } from "./session-state.js";
import { getClaudeToolName } from "./matching.js";
import { normalizeToolInput } from "./text.js";
import type { JsonRecord, RuntimeContextLike, ToolCallEventLike, ToolResultEventLike } from "./types.js";

export function makeBasePayload(eventName: string, ctx: RuntimeContextLike): JsonRecord {
  return { hook_event_name: eventName, session_id: getHookSessionId(ctx), cwd: ctx.cwd };
}
export function buildPreToolUsePayload(event: ToolCallEventLike, ctx: RuntimeContextLike): JsonRecord {
  return {
    ...makeBasePayload("PreToolUse", ctx),
    tool_name: getClaudeToolName(event.toolName),
    tool_input: normalizeToolInput(event.toolName, event.input, ctx.cwd),
    tool_use_id: event.toolCallId,
  };
}
export function buildPostToolUsePayload(event: ToolResultEventLike, ctx: RuntimeContextLike): JsonRecord {
  return {
    ...makeBasePayload("PostToolUse", ctx),
    tool_name: getClaudeToolName(event.toolName),
    tool_input: normalizeToolInput(event.toolName, event.input, ctx.cwd),
    tool_response: { is_error: Boolean(event.isError), content: event.content, details: event.details },
    tool_use_id: event.toolCallId,
  };
}
