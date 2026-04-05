import { McpConnection } from "./connection.js";
import type { DiscoveredTool, McpServerState, NormalizedMcpServer } from "./types.js";

export class McpManager {
  private connections = new Map<string, McpConnection>();
  public sourcePath: string | null = null;

  async replaceServers(servers: NormalizedMcpServer[], sourcePath: string | null): Promise<void> {
    await this.disconnectAll();
    this.connections.clear();
    for (const server of servers) {
      this.connections.set(server.name, new McpConnection(server));
    }
    this.sourcePath = sourcePath;
  }

  async connectAll(): Promise<void> {
    for (const conn of this.connections.values()) {
      if (!conn.server.enabled) continue;
      await conn.connect();
    }
  }

  async disconnectAll(): Promise<void> {
    for (const conn of this.connections.values()) {
      await conn.disconnect();
    }
  }

  getStates(): McpServerState[] {
    return Array.from(this.connections.values()).map((conn) => ({
      name: conn.server.name,
      status: conn.status,
      type: conn.server.type,
      toolCount: conn.tools.length,
      ...(conn.error !== undefined ? { error: conn.error } : {}),
    }));
  }

  getAllTools(): { serverName: string; tool: DiscoveredTool }[] {
    const tools: { serverName: string; tool: DiscoveredTool }[] = [];
    for (const conn of this.connections.values()) {
      if (conn.status !== "connected") continue;
      for (const tool of conn.tools) {
        tools.push({ serverName: conn.server.name, tool });
      }
    }
    return tools;
  }

  async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    const conn = this.connections.get(serverName);
    if (!conn) {
      throw new Error(`MCP server '${serverName}' not found`);
    }
    return conn.callTool(toolName, args);
  }

  async reconnectServer(name: string): Promise<void> {
    const conn = this.connections.get(name);
    if (!conn) return;
    await conn.disconnect();
    await conn.connect();
  }

  getServerTools(name: string): DiscoveredTool[] {
    const conn = this.connections.get(name);
    if (!conn) return [];
    return [...conn.tools];
  }
}
