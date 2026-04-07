import type { ToolMetadata } from "./types-tool.js";
import type { ProxyToolResult } from "./types-proxy.js";

type GetToolsFn = (server: string) => ToolMetadata[] | undefined;
type FindToolFn = (name: string) => ToolMetadata | undefined;
type FormatFn = (schema: unknown) => string;

interface ServerStatus {
	name: string;
	status: string;
	cached?: boolean;
	failedAgo?: string;
}

export interface ConfigLookup {
	hasServer(name: string): boolean;
	serverNames(): string[];
}

export function proxyList(
	server: string | undefined,
	getTools: GetToolsFn,
	config?: ConfigLookup,
): ProxyToolResult {
	if (!server) {
		return text("Provide a server name. Use action: \"status\" to see servers.",
			{ mode: "list" });
	}
	if (config && !config.hasServer(server)) {
		return text(`Server "${server}" not found in config. Known: ${config.serverNames().join(", ")}`,
			{ mode: "list", server, error: "unknown_server" });
	}
	const tools = getTools(server);
	if (!tools || tools.length === 0) {
		const hint = config ? " Try action: \"connect\" to reconnect." : "";
		return text(`No tools found for server "${server}".${hint}`,
			{ mode: "list", server });
	}
	const lines = tools.map((t) => `  - ${t.name}: ${t.description}`);
	return text(`Tools on [${server}]:\n${lines.join("\n")}`,
		{ mode: "list", server });
}

export function proxyDescribe(
	toolName: string | undefined,
	find: FindToolFn,
	format: FormatFn,
): ProxyToolResult {
	if (!toolName) {
		return text("Tool name is required for describe action.",
			{ mode: "describe" });
	}
	const tool = find(toolName);
	if (!tool) {
		return text(`Tool "${toolName}" not found. Try action: "search".`,
			{ mode: "describe", tool: toolName, error: "not_found" });
	}
	const schema = format(tool.inputSchema);
	return text(`[${tool.serverName}] ${tool.name}: ${tool.description}\n\nParameters:\n${schema}`,
		{ mode: "describe", server: tool.serverName, tool: tool.name });
}

export function proxyStatus(servers: ServerStatus[]): ProxyToolResult {
	if (servers.length === 0) return text("No servers configured.", { mode: "status" });
	const lines = servers.map((s) => `  - ${s.name}: ${formatStatus(s)}`);
	return text(`Server status:\n${lines.join("\n")}`, { mode: "status" });
}

function formatStatus(s: ServerStatus): string {
	if (s.status === "connected") return "✓ connected";
	if (s.cached) return "○ cached";
	if (s.failedAgo) return `✗ failed (${s.failedAgo} ago)`;
	return "○ not connected";
}

function text(msg: string, details: Record<string, unknown>): ProxyToolResult {
	return { content: [{ type: "text", text: msg }], details };
}
