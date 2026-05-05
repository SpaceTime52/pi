import { completeSimple } from "@mariozechner/pi-ai";
import { trimSummary } from "./activity.js";
import { buildSummaryPrompt, SUMMARY_SYSTEM_PROMPT } from "./prompt.js";

type SummarizerModel = Parameters<typeof completeSimple>[0];
type SummarizerAuth = { ok: boolean; apiKey?: string; headers?: Record<string, string> };

export type ModelCandidate = { provider: string; id: string };

export type SummarizerContext = {
	modelRegistry?: {
		find: (provider: string, id: string) => SummarizerModel | undefined;
		getApiKeyAndHeaders: (model: SummarizerModel) => Promise<SummarizerAuth>;
	};
};

export type SummarizerResolution = {
	model: SummarizerModel;
	apiKey: string | undefined;
	headers: Record<string, string> | undefined;
	label: string;
};

// Default candidate models, fastest first. The first one with usable auth wins.
export const DEFAULT_SUMMARIZER_CANDIDATES: readonly ModelCandidate[] = [
	{ provider: "anthropic", id: "claude-haiku-4-5" },
	{ provider: "anthropic", id: "claude-3-5-haiku-latest" },
	{ provider: "openai-codex", id: "gpt-5.4-mini" },
	{ provider: "openai-codex", id: "gpt-5.1-codex-mini" },
	{ provider: "google", id: "gemini-2.5-flash" },
	{ provider: "openai", id: "gpt-5-mini" },
	{ provider: "openai", id: "gpt-4o-mini" },
];

export type ResolveResult =
	| { ok: true; resolution: SummarizerResolution }
	| { ok: false; tried: string[] };

export async function resolveSummarizer(
	ctx: SummarizerContext,
	candidates: readonly ModelCandidate[] = DEFAULT_SUMMARIZER_CANDIDATES,
): Promise<ResolveResult> {
	const tried: string[] = [];
	const registry = ctx.modelRegistry;
	if (!registry) return { ok: false, tried: ["no-modelRegistry"] };

	for (const cand of candidates) {
		const label = `${cand.provider}/${cand.id}`;
		const model = registry.find(cand.provider, cand.id);
		if (!model) {
			tried.push(`${label}=missing`);
			continue;
		}
		const auth = await registry.getApiKeyAndHeaders(model).catch((err: unknown) => {
			const msg = err instanceof Error ? err.message : String(err);
			tried.push(`${label}=err:${msg.slice(0, 40)}`);
			return undefined;
		});
		if (!auth) continue;
		if (!auth.ok) {
			tried.push(`${label}=auth-fail`);
			continue;
		}
		// Subscription auth often has empty apiKey but valid headers.
		// Either path is acceptable; let completeSimple decide.
		return {
			ok: true,
			resolution: { model, apiKey: auth.apiKey, headers: auth.headers, label },
		};
	}
	return { ok: false, tried };
}

export type GenerateInput = {
	resolution: SummarizerResolution;
	activity: string;
	signal?: AbortSignal;
};

export type GenerateResult =
	| { ok: true; summary: string }
	| { ok: false; reason: string };

export async function generateLiveSummary({
	resolution,
	activity,
	signal,
}: GenerateInput): Promise<GenerateResult> {
	if (!activity.trim()) return { ok: false, reason: "empty activity" };
	let result: Awaited<ReturnType<typeof completeSimple>>;
	try {
		result = await completeSimple(
			resolution.model,
			{
				systemPrompt: SUMMARY_SYSTEM_PROMPT,
				messages: [
					{
						role: "user",
						content: [{ type: "text", text: buildSummaryPrompt(activity) }],
						timestamp: Date.now(),
					},
				],
			},
			{
				apiKey: resolution.apiKey,
				headers: resolution.headers,
				signal,
				reasoning: "minimal",
				maxTokens: 64,
			},
		);
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		return { ok: false, reason: `complete: ${msg.slice(0, 80)}` };
	}

	if (result.stopReason !== "stop") return { ok: false, reason: `stopReason=${result.stopReason}` };

	const text = (result.content ?? [])
		.filter((c): c is { type: "text"; text: string } => c?.type === "text" && typeof c.text === "string")
		.map((c) => c.text)
		.join("");
	const trimmed = trimSummary(text);
	if (!trimmed) return { ok: false, reason: "empty summary" };
	return { ok: true, summary: trimmed };
}


