import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { extractTextFromBlocks } from "./normalize.js";
import { type JsonRecord, TRANSCRIPT_TMP_DIR } from "./types.js";

interface TranscriptMessageLike {
  role: string;
  content: unknown;
  toolCallId?: string;
}

function toTranscriptMessageLike(message: unknown): TranscriptMessageLike | null {
  if (!message || typeof message !== "object") return null;
  const obj = message as JsonRecord;
  const role = obj.role;
  if (typeof role !== "string") return null;
  const toolCallId = typeof obj.toolCallId === "string" ? obj.toolCallId : undefined;
  const like: TranscriptMessageLike = { role, content: obj.content };
  if (toolCallId !== undefined) like.toolCallId = toolCallId;
  return like;
}

function mapAssistantTranscriptContent(content: unknown[]): JsonRecord[] {
  const mapped: JsonRecord[] = [];
  for (const raw of content) {
    if (!raw || typeof raw !== "object") continue;
    const block = raw as JsonRecord;
    if (block.type === "text" && typeof block.text === "string") {
      mapped.push({ type: "text", text: block.text });
      continue;
    }
    if (block.type === "toolCall") {
      mapped.push({
        type: "tool_use",
        id: block.id,
        name: block.name,
        input: block.arguments,
      });
    }
  }
  return mapped;
}

function mapUserTranscriptContent(content: unknown): JsonRecord[] {
  if (!Array.isArray(content)) return [];
  const mapped: JsonRecord[] = [];
  for (const raw of content) {
    if (!raw || typeof raw !== "object") continue;
    const block = raw as JsonRecord;
    if (block.type === "text" && typeof block.text === "string") {
      mapped.push({ type: "text", text: block.text });
    }
  }
  return mapped;
}

function mapTranscriptLine(message: TranscriptMessageLike): string | null {
  if (message.role === "assistant") {
    const mapped = Array.isArray(message.content)
      ? mapAssistantTranscriptContent(message.content as unknown[])
      : [];
    return mapped.length > 0
      ? JSON.stringify({ type: "assistant", message: { content: mapped } })
      : null;
  }

  if (message.role === "user") {
    const mapped = mapUserTranscriptContent(message.content);
    return mapped.length > 0
      ? JSON.stringify({ type: "user", message: { content: mapped } })
      : null;
  }

  if (message.role !== "toolResult") {
    return null;
  }

  const text = extractTextFromBlocks(message.content);
  return JSON.stringify({
    type: "user",
    message: {
      content: [
        {
          type: "tool_result",
          tool_use_id: message.toolCallId,
          content: [{ type: "text", text }],
        },
      ],
    },
  });
}

function toClaudeTranscriptLines(ctx: ExtensionContext): string[] {
  const lines: string[] = [];
  const entries = ctx.sessionManager.getEntries();

  for (const entry of entries) {
    if (!entry || entry.type !== "message") continue;
    const message = toTranscriptMessageLike(entry.message);
    if (!message) continue;
    const line = mapTranscriptLine(message);
    if (line) lines.push(line);
  }

  return lines;
}

export function createTranscriptFile(ctx: ExtensionContext, sessionId: string): string | undefined {
  try {
    const lines = toClaudeTranscriptLines(ctx);
    mkdirSync(TRANSCRIPT_TMP_DIR, { recursive: true });
    const safeSessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const transcriptPath = path.join(TRANSCRIPT_TMP_DIR, `${safeSessionId}.jsonl`);
    const content = lines.length > 0 ? `${lines.join("\n")}\n` : "";
    writeFileSync(transcriptPath, content, "utf8");
    return transcriptPath;
  } catch {
    return undefined;
  }
}

export function getLastAssistantMessage(ctx: ExtensionContext): string | undefined {
  const entries = ctx.sessionManager.getEntries();
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i];
    if (!entry || entry.type !== "message") continue;
    const message = toTranscriptMessageLike(entry.message);
    if (!message || message.role !== "assistant") continue;
    const text = extractTextFromBlocks(message.content);
    if (text) return text;
  }
  return undefined;
}
