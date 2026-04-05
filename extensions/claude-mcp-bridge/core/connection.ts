import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  EXTENSION_CLIENT_NAME,
  EXTENSION_CLIENT_VERSION,
  INITIAL_RECONNECT_DELAY_MS,
  MAX_RECONNECT_ATTEMPTS,
  MAX_RECONNECT_DELAY_MS,
} from "./constants.js";
import type {
  DiscoveredTool,
  HttpMcpServer,
  NormalizedMcpServer,
  ServerStatus,
  SseMcpServer,
  StdioMcpServer,
} from "./types.js";

function createStdioTransport(server: StdioMcpServer): StdioClientTransport {
  const stderr = process.env.PI_MCP_STDERR === "inherit" ? "inherit" : "ignore";
  return new StdioClientTransport({
    command: server.command,
    args: server.args,
    env: server.env,
    ...(server.cwd ? { cwd: server.cwd } : {}),
    stderr,
  });
}

interface EventSourceInitWithFetch extends EventSourceInit {
  fetch?: (url: string | URL, init?: RequestInit) => Promise<Response>;
}

function createSseTransport(server: SseMcpServer): SSEClientTransport {
  const sseHeaders = server.headers;
  const hasHeaders = Object.keys(sseHeaders).length > 0;
  const eventSourceInit: EventSourceInitWithFetch | undefined = hasHeaders
    ? {
        fetch: (url: string | URL, init?: RequestInit) =>
          fetch(url, {
            ...init,
            headers: { ...init?.headers, ...sseHeaders },
          }),
      }
    : undefined;
  return new SSEClientTransport(new URL(server.url), {
    ...(eventSourceInit ? { eventSourceInit } : {}),
    requestInit: { headers: sseHeaders },
  });
}

function createHttpTransport(server: HttpMcpServer): StreamableHTTPClientTransport {
  return new StreamableHTTPClientTransport(new URL(server.url), {
    requestInit: { headers: server.headers },
  });
}

async function connectClient(client: Client, server: NormalizedMcpServer): Promise<McpTransport> {
  if (server.type === "stdio") {
    const transport = createStdioTransport(server);
    await client.connect(transport);
    return transport;
  }
  if (server.type === "sse") {
    const transport = createSseTransport(server);
    await client.connect(transport);
    return transport;
  }
  const transport = createHttpTransport(server);
  await connectHttpTransport(client, transport);
  return transport;
}

// StreamableHTTPClientTransport exposes `sessionId` as a getter returning
// `string | undefined`, while the Transport interface declares `sessionId?: string`.
// Under exactOptionalPropertyTypes these aren't directly assignable even though
// the runtime behavior is identical (reading either yields `string | undefined`).
// A transparent Proxy delegates every property access/mutation to the underlying
// transport, so any new fields the SDK adds later flow through automatically.
// The single `as` cast only narrows the getter-vs-optional-property mismatch;
// the Proxy itself preserves structural identity with the real transport.
type ConnectableTransport = Parameters<Client["connect"]>[0];

function wrapForConnect(transport: StreamableHTTPClientTransport): ConnectableTransport {
  return new Proxy(transport, {}) as ConnectableTransport;
}

async function connectHttpTransport(
  client: Client,
  transport: StreamableHTTPClientTransport,
): Promise<void> {
  await client.connect(wrapForConnect(transport));
}

interface McpTransport {
  close(): Promise<void>;
}

export class McpConnection {
  private client: Client | null = null;
  private transport: McpTransport | null = null;

  /** When true, suppress onclose/onerror side-effects (e.g. during intentional disconnect or cleanup). */
  private intentionalDisconnect = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  /** Deduplicates concurrent connect() calls. */
  private connectingPromise: Promise<void> | null = null;

  public status: ServerStatus = "disconnected";
  public error: string | undefined = undefined;
  public tools: DiscoveredTool[] = [];

  constructor(public readonly server: NormalizedMcpServer) {}

  async connect(): Promise<void> {
    if (this.connectingPromise) return this.connectingPromise;
    this.connectingPromise = this.runConnect();
    try {
      await this.connectingPromise;
    } finally {
      this.connectingPromise = null;
    }
  }

  async disconnect(): Promise<void> {
    this.intentionalDisconnect = true;
    this.clearReconnectTimer();
    await this.cleanupConnection();

    if (this.status !== "error") {
      this.status = "disconnected";
      this.error = undefined;
    }
    this.tools = [];
  }

  async refreshTools(): Promise<void> {
    if (!this.client) return;
    try {
      const result = await this.client.listTools();
      this.tools = result.tools.map((tool) => ({
        name: tool.name,
        ...(tool.description !== undefined ? { description: tool.description } : {}),
        inputSchema: (tool.inputSchema ?? {}) as Record<string, unknown>,
      }));
    } catch {
      this.tools = [];
    }
  }

  async ensureConnected(): Promise<void> {
    if (this.status === "connected" && this.client) return;

    if (this.connectingPromise) {
      await this.connectingPromise;
      if (this.status === "connected" && this.client) return;
    }

    this.clearReconnectTimer();
    this.reconnectAttempts = 0;
    await this.connect();
  }

  async callTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.client || this.status !== "connected") {
      await this.ensureConnected();
    }
    if (!this.client || this.status !== "connected") {
      throw new Error(`MCP server '${this.server.name}' is not connected (status: ${this.status})`);
    }
    return this.client.callTool({ name: toolName, arguments: args });
  }

  private installClientHandlers(client: Client): void {
    client.onclose = () => {
      if (this.intentionalDisconnect) return;
      this.status = "disconnected";
      this.client = null;
      this.transport = null;
      this.scheduleReconnect();
    };

    client.onerror = (error: Error) => {
      if (this.intentionalDisconnect) return;
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("unknown message ID")) return;
      this.error = msg;
    };
  }

  private async runConnect(): Promise<void> {
    this.clearReconnectTimer();

    this.intentionalDisconnect = true;
    await this.cleanupConnection();
    this.intentionalDisconnect = false;

    this.status = "connecting";
    this.error = undefined;
    this.tools = [];

    try {
      const client = new Client(
        { name: EXTENSION_CLIENT_NAME, version: EXTENSION_CLIENT_VERSION },
        { capabilities: {} },
      );
      this.client = client;
      this.transport = await connectClient(client, this.server);
      this.installClientHandlers(client);

      await this.refreshTools();
      this.status = "connected";
      this.reconnectAttempts = 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.intentionalDisconnect = true;
      await this.cleanupConnection();
      this.intentionalDisconnect = false;

      this.status = "error";
      this.error = message;
    }
  }

  private async cleanupConnection(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
      } catch {
        /* ignore */
      }
      this.client = null;
    }
    if (this.transport) {
      try {
        await this.transport.close();
      } catch {
        /* ignore */
      }
      this.transport = null;
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();

    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.status = "error";
      this.error = `Reconnection failed after ${MAX_RECONNECT_ATTEMPTS} attempts for '${this.server.name}'`;
      return;
    }

    const delay = Math.min(
      INITIAL_RECONNECT_DELAY_MS * 2 ** this.reconnectAttempts,
      MAX_RECONNECT_DELAY_MS,
    );
    this.reconnectAttempts++;
    this.status = "connecting";

    this.reconnectTimer = setTimeout(async () => {
      await this.connect();
      if (this.status !== "connected" && !this.intentionalDisconnect) {
        this.scheduleReconnect();
      }
    }, delay);
  }
}
