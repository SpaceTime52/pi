import path from "node:path";
import type { JsonRecord } from "./types.js";

function resolveMaybePath(inputPath: string, cwd: string): string {
  if (path.isAbsolute(inputPath)) return path.normalize(inputPath);
  return path.resolve(cwd, inputPath);
}

function pickPathCandidate(input: JsonRecord): string | undefined {
  if (typeof input.path === "string") return input.path;
  if (typeof input.file_path === "string") return input.file_path;
  if (typeof input.filePath === "string") return input.filePath;
  return undefined;
}

export function normalizeToolInput(toolName: string, rawInput: unknown, cwd: string): JsonRecord {
  const input: JsonRecord =
    rawInput && typeof rawInput === "object" ? { ...(rawInput as JsonRecord) } : {};

  const pathCandidate = pickPathCandidate(input);

  if (pathCandidate) {
    const absolute = resolveMaybePath(pathCandidate, cwd);
    input.path = absolute;
    input.file_path = absolute;
    input.filePath = absolute;
  }

  if (toolName === "bash" && typeof input.command !== "string") {
    input.command = "";
  }

  return input;
}

export function extractTextFromBlocks(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  const lines: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const text = (block as JsonRecord).text;
    if (typeof text === "string") lines.push(text);
  }
  return lines.join("");
}
