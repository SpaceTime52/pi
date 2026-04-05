import type { ExtensionContext } from "@mariozechner/pi-coding-agent";

export interface RawMcpServer {
  type?: string;
  enabled?: boolean;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  url?: string;
  headers?: Record<string, string>;
}

export interface StdioMcpServer {
  name: string;
  type: "stdio";
  enabled: boolean;
  command: string;
  args: string[];
  env: Record<string, string>;
  cwd?: string;
}

export interface SseMcpServer {
  name: string;
  type: "sse";
  enabled: boolean;
  url: string;
  headers: Record<string, string>;
}

export interface HttpMcpServer {
  name: string;
  type: "http";
  enabled: boolean;
  url: string;
  headers: Record<string, string>;
}

export type NormalizedMcpServer = StdioMcpServer | SseMcpServer | HttpMcpServer;

export interface DiscoveredTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export type ServerStatus = "connecting" | "connected" | "disconnected" | "error";

export interface LoadedConfig {
  sourcePath: string | null;
  servers: NormalizedMcpServer[];
  warnings: string[];
}

export interface McpServerState {
  name: string;
  status: ServerStatus;
  type: string;
  toolCount: number;
  error?: string;
}

export type ServerAction = "tools" | "reconnect";

export type ReloadableContext = ExtensionContext & { reload: () => Promise<void> };

export interface FormattedToolResult {
  text: string;
  imagePaths: string[];
}

export interface PreparedPayload {
  text: string;
  truncated: boolean;
  fullPayloadPath?: string;
  originalLength: number;
}
