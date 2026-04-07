import type { ProxyToolResult } from "./types-proxy.js";
import type { McpContent, ReadResourceResult } from "./types-server.js";
import type { ResolveDeps } from "./proxy-resolve.js";
import { resolveTool, isResolveError } from "./proxy-resolve.js";

interface CallClient {
	callTool(params: { name: string; arguments?: Record<string, unknown> }): Promise<{ content: McpContent[] }>;
	readResource(params: { uri: string }): Promise<ReadResourceResult>;
}

interface CallConnection {
	name: string;
	client: CallClient;
	status: string;
	lastUsedAt: number;
	inFlight: number;
}

type ContentBlock = { type: "text"; text: string } | { type: "image"; data: string; mimeType: string };

export interface CallDeps extends ResolveDeps {
	getOrConnect: (server: string) => Promise<CallConnection>;
	checkConsent: (server: string) => Promise<boolean>;
	transform: (content: McpContent) => ContentBlock;
}

function resourceToContent(result: ReadResourceResult): McpContent[] {
	return result.contents.map((c) => ({
		type: "text" as const,
		text: c.text ?? c.blob ?? "",
	}));
}

export async function proxyCall(
	toolName: string,
	args: Record<string, unknown> | undefined,
	deps: CallDeps,
): Promise<ProxyToolResult> {
	const resolved = await resolveTool(toolName, deps);
	if (isResolveError(resolved)) {
		return {
			content: [{ type: "text", text: resolved.message }],
			details: { mode: "call", tool: toolName, error: "not_found" },
		};
	}
	const { meta } = resolved;
	const allowed = await deps.checkConsent(meta.serverName);
	if (!allowed) {
		return {
			content: [{ type: "text", text: `Execution denied for server "${meta.serverName}".` }],
			details: { mode: "call", server: meta.serverName, tool: toolName, error: "denied" },
		};
	}
	const conn = await deps.getOrConnect(meta.serverName);
	conn.inFlight++;
	try {
		const content = meta.resourceUri
			? resourceToContent(await conn.client.readResource({ uri: meta.resourceUri }))
			: (await conn.client.callTool({ name: meta.originalName, arguments: args })).content;
		conn.lastUsedAt = Date.now();
		return {
			content: content.map(deps.transform),
			details: { mode: "call", server: meta.serverName, tool: meta.name },
		};
	} finally {
		conn.inFlight--;
	}
}
