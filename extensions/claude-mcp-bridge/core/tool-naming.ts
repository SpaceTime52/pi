import { MAX_TOOL_NAME_LENGTH, MCP_TOOL_NAME_PREFIX } from "./constants.js";

export function sanitizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, MAX_TOOL_NAME_LENGTH);
}

export function buildPiToolName(serverName: string, toolName: string): string {
  const safeServer = sanitizeName(serverName) || "server";
  const safeTool = sanitizeName(toolName) || "tool";
  return `${MCP_TOOL_NAME_PREFIX}${safeServer}_${safeTool}`;
}
