import type { ToolMetadata } from "./types-tool.js";

export interface ResolveFailure {
	at: number;
	count: number;
}

export interface ResolveDeps {
	findTool: (name: string) => ToolMetadata | undefined;
	getAllMetadata: () => Map<string, ToolMetadata[]>;
	getConfig: () => { mcpServers: Record<string, unknown> } | null;
	connectServer: (name: string) => Promise<void>;
	getBackoffMs: (server: string) => number;
	getFailure: (server: string) => ResolveFailure | undefined;
}

export interface ResolveResult {
	meta: ToolMetadata;
	lazyConnected: boolean;
}

export interface ResolveError {
	message: string;
}

function prefixMatch(
	toolName: string,
	metadata: Map<string, ToolMetadata[]>,
): ToolMetadata | undefined {
	const idx = toolName.indexOf("_");
	if (idx === -1) return undefined;
	const prefix = toolName.slice(0, idx);
	const rest = toolName.slice(idx + 1);
	const serverTools = metadata.get(prefix);
	if (!serverTools) return undefined;
	return serverTools.find((t) => t.originalName === rest);
}

function findInAllMetadata(
	toolName: string,
	metadata: Map<string, ToolMetadata[]>,
): ToolMetadata | undefined {
	for (const tools of metadata.values()) {
		const found = tools.find((t) => t.name === toolName);
		if (found) return found;
	}
	return prefixMatch(toolName, metadata);
}

function checkBackoff(
	server: string,
	deps: ResolveDeps,
): string | undefined {
	const backoffMs = deps.getBackoffMs(server);
	if (backoffMs <= 0) return undefined;
	const failure = deps.getFailure(server);
	if (!failure) return undefined;
	if (Date.now() - failure.at < backoffMs) {
		return `Server "${server}" recently failed, retry later.`;
	}
	return undefined;
}

export async function resolveTool(
	toolName: string,
	deps: ResolveDeps,
): Promise<ResolveResult | ResolveError> {
	const exact = deps.findTool(toolName);
	if (exact) return { meta: exact, lazyConnected: false };

	const allMeta = deps.getAllMetadata();
	const found = findInAllMetadata(toolName, allMeta);
	if (found) return { meta: found, lazyConnected: false };

	const config = deps.getConfig();
	if (!config) return { message: `Tool "${toolName}" not found. Try action: "search".` };

	for (const serverName of Object.keys(config.mcpServers)) {
		if (allMeta.has(serverName)) continue;
		const backoffErr = checkBackoff(serverName, deps);
		if (backoffErr) continue;
		await deps.connectServer(serverName);
		const refreshed = deps.getAllMetadata();
		const match = findInAllMetadata(toolName, refreshed);
		if (match) return { meta: match, lazyConnected: true };
	}
	return { message: `Tool "${toolName}" not found. Try action: "search".` };
}

export function isResolveError(r: ResolveResult | ResolveError): r is ResolveError {
	return "message" in r;
}
