import type { Api, Model } from "@mariozechner/pi-ai";

export const MAX_SECTION_LENGTH = 240;
export const MAX_TRANSCRIPT_LENGTH = 12000;
export const OVERVIEW_PROMPT = [
	"You maintain concise coding-session overviews.",
	"Return exactly this format:",
	"TITLE: <short title in the user's language, max 8 words>",
	"SUMMARY:",
	"<2-4 short summary lines about the current session state>",
	"Write the summary in plain natural language without Goal/Done/Note/Next labels.",
	"Do not use markdown bullets, code fences, or extra sections.",
].join(" ");

export type SessionOverviewModel = Model<Api>;
export type SessionOverviewAuth = { ok: true; apiKey?: string; headers?: Record<string, string> } | { ok: false; error: string };
export interface SessionOverviewModelRegistry { getApiKeyAndHeaders(model: SessionOverviewModel): Promise<SessionOverviewAuth>; }
export interface ResolveSessionOverviewOptions { recentText: string; previous?: { title: string; summary: readonly string[] }; model: SessionOverviewModel | undefined; modelRegistry: SessionOverviewModelRegistry; }
