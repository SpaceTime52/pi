import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { LoadedConfig, NormalizedMcpServer, RawMcpServer } from "./types.js";

export function expandEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, key: string) => process.env[key] ?? "");
}

export function expandRecord(input?: Record<string, string>): Record<string, string> {
  const output: Record<string, string> = {};
  if (!input) return output;
  for (const [k, v] of Object.entries(input)) {
    output[k] = expandEnvVars(v);
  }
  return output;
}

export function safeReadJson(filePath: string): unknown | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function extractRawServers(data: unknown): Record<string, RawMcpServer> | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;

  if (record.mcpServers && typeof record.mcpServers === "object") {
    return record.mcpServers as Record<string, RawMcpServer>;
  }

  const mcp = record.mcp as Record<string, unknown> | undefined;
  if (mcp?.servers && typeof mcp.servers === "object") {
    return mcp.servers as Record<string, RawMcpServer>;
  }

  if (record.servers && typeof record.servers === "object") {
    return record.servers as Record<string, RawMcpServer>;
  }

  return null;
}

function buildStdioServer(name: string, raw: RawMcpServer): NormalizedMcpServer | null {
  if (!raw.command) return null;

  const envFromProcess: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v === "string") envFromProcess[k] = v;
  }

  return {
    name,
    type: "stdio",
    enabled: true,
    command: expandEnvVars(raw.command),
    args: (raw.args ?? []).map(expandEnvVars),
    env: { ...envFromProcess, ...expandRecord(raw.env) },
    ...(raw.cwd ? { cwd: expandEnvVars(raw.cwd) } : {}),
  };
}

function buildRemoteServer(
  name: string,
  raw: RawMcpServer,
  type: string | undefined,
): NormalizedMcpServer | null {
  if (!raw.url) return null;

  const expandedUrl = expandEnvVars(raw.url);
  const headers = expandRecord(raw.headers);
  let inferred: "sse" | "http";
  if (type === "sse") {
    inferred = "sse";
  } else if (type === "http") {
    inferred = "http";
  } else if (/\/sse(?:\/)?(?:\?|$)/i.test(expandedUrl)) {
    inferred = "sse";
  } else {
    inferred = "http";
  }

  return {
    name,
    type: inferred,
    enabled: true,
    url: expandedUrl,
    headers,
  };
}

export function normalizeServer(name: string, raw: RawMcpServer): NormalizedMcpServer | null {
  if (raw.enabled === false) return null;
  const type = raw.type?.toLowerCase();

  if (raw.command || type === "stdio") {
    return buildStdioServer(name, raw);
  }

  if (raw.url) {
    return buildRemoteServer(name, raw, type);
  }

  return null;
}

export function collectScopedConfigCandidates(cwd: string): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();

  const push = (candidate: string): void => {
    const resolved = path.resolve(candidate);
    if (seen.has(resolved)) return;
    seen.add(resolved);
    candidates.push(resolved);
  };

  let current = path.resolve(cwd);
  const home = path.resolve(os.homedir());
  const root = path.parse(current).root;

  while (true) {
    push(path.join(current, ".pi", "mcp.json"));
    push(path.join(current, ".mcp.json"));
    push(path.join(current, "backend", ".mcp.json"));
    push(path.join(current, "frontend", ".mcp.json"));

    if (current === home || current === root) break;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  push(path.join(os.homedir(), ".mcp.json"));
  push(path.join(os.homedir(), ".claude.json"));

  return candidates;
}

export function loadConfig(cwd: string): LoadedConfig {
  const warnings: string[] = [];

  const explicitPath = process.env.PI_MCP_CONFIG;
  const candidates = explicitPath
    ? [path.resolve(expandEnvVars(explicitPath))]
    : collectScopedConfigCandidates(cwd);

  const loadedSources: string[] = [];
  const serversByName = new Map<string, NormalizedMcpServer>();

  for (const candidate of candidates) {
    const parsed = safeReadJson(candidate);
    if (!parsed) continue;

    const rawServers = extractRawServers(parsed);
    if (!rawServers || Object.keys(rawServers).length === 0) continue;
    loadedSources.push(candidate);

    for (const [name, raw] of Object.entries(rawServers)) {
      if (serversByName.has(name)) {
        warnings.push(`Skipped duplicate MCP server config: ${name} (from ${candidate})`);
        continue;
      }

      const normalized = normalizeServer(name, raw);
      if (normalized) serversByName.set(name, normalized);
      else warnings.push(`Skipped invalid MCP server config: ${name}`);
    }
  }

  return {
    sourcePath: loadedSources.length > 0 ? loadedSources.join(", ") : null,
    servers: Array.from(serversByName.values()),
    warnings,
  };
}
