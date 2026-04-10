import type { Api, Model } from "@mariozechner/pi-ai";

export const MAX_SECTION_LENGTH = 240;
export const MAX_TRANSCRIPT_LENGTH = 12000;
export const OVERVIEW_PROMPT = [
	"You maintain coding-session overviews.",
	"Treat the previous summary as the baseline state for the session.",
	"Carry forward still-relevant context unless recent updates clearly resolve or replace it.",
	"Do not overwrite the whole summary with only the latest turn.",
	"Write this as a quick reference for a user resuming the session later.",
	"Prioritize durable context: the current goal, important decisions, meaningful progress, blockers, and the next important step.",
	"Ignore routine greetings, acknowledgements, branch-name checks, shell state, raw tool chatter, toy/demo exchanges, and the fact that the assistant replied unless they materially change the task.",
	"If the recent updates contain no durable change, keep the previous title and summary unchanged.",
	"Return exactly this format:",
	"TITLE: <short title in the user's language, max 8 words, naming the durable task rather than chatty or incidental details>",
	"SUMMARY: <a cohesive current-state summary in the user's language>",
	"Prefer one dense paragraph; use a second paragraph only when it materially improves clarity.",
	"Describe the current state rather than retelling events in chronological order.",
	"Merge related updates into prose instead of writing one line per turn or tool call.",
	"Do not drop still-relevant context merely to make the summary shorter.",
	"Do not use markdown bullets, numbered lists, code fences, or extra sections.",
].join(" ");

export type SessionOverviewModel = Model<Api>;
export type SessionOverviewAuth = { ok: true; apiKey?: string; headers?: Record<string, string> } | { ok: false; error: string };
export interface SessionOverviewModelRegistry { getApiKeyAndHeaders(model: SessionOverviewModel): Promise<SessionOverviewAuth>; }
export interface ResolveSessionOverviewOptions { recentText: string; previous?: { title: string; summary: readonly string[] }; model: SessionOverviewModel | undefined; modelRegistry: SessionOverviewModelRegistry; }
