import type { FetchFn } from "./types.js";
import { callExaMcp } from "./exa-mcp.js";
import { webSearch } from "./search.js";

const CODE_CONTEXT_TOOL = "get_code_context_exa";

export function isMissingCodeContextToolError(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error);
	return message.includes(`Tool ${CODE_CONTEXT_TOOL} not found`);
}

function buildFallbackQuery(query: string): string {
	return `${query} code examples api reference documentation github`;
}

export function buildFallbackResult(answer: string, results: Array<{ title: string; url: string }>): string {
	const sources = results.map((r) => `- [${r.title}](${r.url})`).join("\n");
	return [answer.trim(), sources ? `## Sources\n${sources}` : ""].filter(Boolean).join("\n\n");
}

function fallbackResultCount(maxTokens: number): number {
	return Math.max(3, Math.min(10, Math.ceil(maxTokens / 1500)));
}

export async function codeSearch(
	query: string,
	maxTokens: number,
	fetchImpl: FetchFn = fetch,
	signal?: AbortSignal,
): Promise<string> {
	try {
		return await callExaMcp(CODE_CONTEXT_TOOL, { query, tokensNum: maxTokens }, fetchImpl, signal);
	} catch (error) {
		if (!isMissingCodeContextToolError(error)) throw error;
		const { answer, results } = await webSearch(buildFallbackQuery(query), fallbackResultCount(maxTokens), fetchImpl, signal);
		return buildFallbackResult(answer, results);
	}
}
