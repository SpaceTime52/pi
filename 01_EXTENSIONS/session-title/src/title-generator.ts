import { completeSimple } from "@mariozechner/pi-ai";
import { buildFallbackTitle } from "./fallback-title.js";
import {
	TITLE_SYSTEM_PROMPT,
	buildTitlePrompt,
	extractTextContent,
	isClearSummaryTitle,
	normalizeTitle,
} from "./title-format.js";

type TitleModel = Parameters<typeof completeSimple>[0];
type TitleAuth = { ok: boolean; apiKey?: string; headers?: Record<string, string> };

export type TitleGeneratorContext = {
	model?: TitleModel;
	modelRegistry?: { getApiKeyAndHeaders: (model: TitleModel) => Promise<TitleAuth> };
};

export async function generateSessionTitle(ctx: TitleGeneratorContext, userPrompt: string): Promise<string> {
	const fallbackTitle = buildFallbackTitle(userPrompt);
	if (!ctx.model || !ctx.modelRegistry) return fallbackTitle;
	const auth = await ctx.modelRegistry.getApiKeyAndHeaders(ctx.model).catch(() => undefined);
	if (!auth?.ok) return fallbackTitle;
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 10000);
	const result = await completeSimple(
		ctx.model,
		{ systemPrompt: TITLE_SYSTEM_PROMPT, messages: [{ role: "user", content: [{ type: "text", text: buildTitlePrompt(userPrompt) }], timestamp: Date.now() }] },
		{ apiKey: auth.apiKey, headers: auth.headers, signal: controller.signal, reasoning: "minimal", maxTokens: 80 },
	).catch(() => undefined);
	clearTimeout(timeoutId);
	if (!result || result.stopReason !== "stop") return fallbackTitle;
	const generatedTitle = normalizeTitle(extractTextContent(result.content));
	return isClearSummaryTitle(generatedTitle) ? generatedTitle : fallbackTitle;
}
