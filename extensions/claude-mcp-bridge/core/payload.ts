import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { LARGE_PAYLOAD_PREVIEW_CHARS, LARGE_PAYLOAD_THRESHOLD_CHARS } from "./constants.js";
import { sanitizeName } from "./tool-naming.js";
import type { FormattedToolResult, PreparedPayload } from "./types.js";

function mimeToExt(mimeType: string): string {
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/gif":
      return "gif";
    case "image/webp":
      return "webp";
    case "image/svg+xml":
      return "svg";
    default:
      return "png";
  }
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

function buildTruncationMessage(originalLength: number): string {
  const omitted = originalLength - LARGE_PAYLOAD_PREVIEW_CHARS;
  return `[Truncated output: first ${LARGE_PAYLOAD_PREVIEW_CHARS} chars shown, ${omitted} chars omitted]`;
}

export function preparePayloadForClient(
  text: string,
  serverName: string,
  toolName: string,
): PreparedPayload {
  const originalLength = text.length;
  if (originalLength <= LARGE_PAYLOAD_THRESHOLD_CHARS) {
    return { text, truncated: false, originalLength };
  }

  const preview = text.slice(0, LARGE_PAYLOAD_PREVIEW_CHARS);
  const safeServer = sanitizeName(serverName) || "server";
  const safeTool = sanitizeName(toolName) || "tool";
  const fileName = `mcp-payload-${safeServer}-${safeTool}-${Date.now()}-${randomSuffix()}.txt`;
  const filePath = path.join(os.tmpdir(), fileName);

  try {
    fs.writeFileSync(filePath, text, "utf-8");
    return {
      text: [
        preview,
        "",
        buildTruncationMessage(originalLength),
        `[Full payload saved to: ${filePath}]`,
        "Use Read tool (or another file reader) to inspect the full payload.",
      ].join("\n"),
      truncated: true,
      fullPayloadPath: filePath,
      originalLength,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      text: [
        preview,
        "",
        buildTruncationMessage(originalLength),
        `[Failed to save full payload: ${message}]`,
      ].join("\n"),
      truncated: true,
      originalLength,
    };
  }
}

interface McpContentItem {
  type?: string;
  text?: string;
  data?: string;
  mimeType?: string;
}

function writeImageToTmp(item: McpContentItem, imagePaths: string[]): string {
  if (!item.data) return JSON.stringify(item);
  const ext = mimeToExt(item.mimeType ?? "image/png");
  const tmpFile = path.join(os.tmpdir(), `mcp-image-${Date.now()}-${randomSuffix()}.${ext}`);
  try {
    fs.writeFileSync(tmpFile, Buffer.from(item.data, "base64"));
    imagePaths.push(tmpFile);
    return `[Image saved: ${tmpFile}]`;
  } catch {
    return `[Image save failed: ${item.mimeType}, ${item.data.length} chars]`;
  }
}

function renderContentItem(item: McpContentItem, imagePaths: string[]): string {
  if (item?.type === "text") return item.text ?? "";
  if (item?.type === "image" && item.data) return writeImageToTmp(item, imagePaths);
  return JSON.stringify(item);
}

export function formatToolResult(result: unknown): FormattedToolResult {
  const imagePaths: string[] = [];

  if (typeof result === "string") return { text: result, imagePaths };

  if (result && typeof result === "object") {
    const maybe = result as {
      content?: McpContentItem[];
      structuredContent?: unknown;
    };

    if (Array.isArray(maybe.content)) {
      const chunks = maybe.content
        .map((item) => renderContentItem(item, imagePaths))
        .filter(Boolean);
      if (chunks.length > 0) return { text: chunks.join("\n"), imagePaths };
    }

    if (maybe.structuredContent !== undefined) {
      return { text: JSON.stringify(maybe.structuredContent, null, 2), imagePaths };
    }
  }

  return { text: JSON.stringify(result, null, 2), imagePaths };
}

export function buildMcpToolResultContent(
  formatted: FormattedToolResult,
  prepared: PreparedPayload,
): { type: "text"; text: string }[] {
  const content: { type: "text"; text: string }[] = [{ type: "text", text: prepared.text }];
  for (const imgPath of formatted.imagePaths) {
    content.push({ type: "text", text: `Use Read tool to view: ${imgPath}` });
  }
  if (prepared.fullPayloadPath) {
    content.push({ type: "text", text: `Full payload file: ${prepared.fullPayloadPath}` });
  }
  return content;
}
