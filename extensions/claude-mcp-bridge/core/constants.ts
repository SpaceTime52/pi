import os from "node:os";
import path from "node:path";

export const MAX_RECONNECT_ATTEMPTS = 5;
export const INITIAL_RECONNECT_DELAY_MS = 2_000;
export const MAX_RECONNECT_DELAY_MS = 30_000;

export const TOOL_VISIBILITY_SETTINGS_PATH = path.join(
  os.homedir(),
  ".pi",
  "agent",
  "claude-mcp-bridge-tools.json",
);
export const TOOL_VISIBILITY_KEY_SEPARATOR = "\u001f";

export const LARGE_PAYLOAD_THRESHOLD_CHARS = 30_000;
export const LARGE_PAYLOAD_PREVIEW_CHARS = 1_000;

export const EXTENSION_CLIENT_NAME = "pi-claude-mcp-bridge";
export const EXTENSION_CLIENT_VERSION = "0.1.0";

export const MCP_TOOL_NAME_PREFIX = "mcp_";
export const MAX_TOOL_NAME_LENGTH = 80;
