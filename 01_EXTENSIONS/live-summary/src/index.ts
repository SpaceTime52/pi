import path from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { extractActivityText } from "./activity.js";
import { type Badge, badgeFor } from "./badge.js";
import { buildStatus, buildTitle, type OutputState } from "./output.js";
import {
	DEFAULT_SUMMARIZER_CANDIDATES,
	generateLiveSummary,
	type ModelCandidate,
	resolveSummarizer,
	type SummarizerResolution,
} from "./summarizer.js";

const SUMMARY_TICK_MS = 5_000;
const MIN_SUMMARY_GAP_MS = 4_000;
const STATUS_KEY = "live-summary";
const WIDGET_KEY = "live-summary";
const PERSIST_TYPE = "live-summary";

type State = {
	cachedSummary: string;
	pinnedSummary: string | null;
	pinnedBadge: Badge | null;
	autoBadge: Badge;
	isWorking: boolean;
	dirty: boolean;
	lastSummarizedLeafId: string | undefined;
	lastSummaryAt: number;
	resolution: SummarizerResolution | null | undefined;
	candidates: readonly ModelCandidate[];
	lastError: string | null;
	summarizeCount: number;
	inflight: AbortController | null;
};

export default function liveSummaryExtension(pi: ExtensionAPI) {
	const state: State = {
		cachedSummary: "",
		pinnedSummary: null,
		pinnedBadge: null,
		autoBadge: badgeFor(`pid:${process.pid}`),
		isWorking: false,
		dirty: false,
		lastSummarizedLeafId: undefined,
		lastSummaryAt: 0,
		resolution: undefined,
		candidates: DEFAULT_SUMMARIZER_CANDIDATES,
		lastError: null,
		summarizeCount: 0,
		inflight: null,
	};
	let timer: ReturnType<typeof setInterval> | null = null;

	const toOutputState = (): OutputState => ({
		cwdBasename: path.basename(process.cwd()) || "pi",
		sessionName: pi.getSessionName() || undefined,
		cachedSummary: state.cachedSummary,
		pinnedSummary: state.pinnedSummary,
		pinnedBadge: state.pinnedBadge,
		autoBadge: state.autoBadge,
		isWorking: state.isWorking,
	});

	const applyOutputs = (ctx: ExtensionContext) => {
		if (!ctx.hasUI) return;
		const out = toOutputState();
		const title = buildTitle(out);
		const line = buildStatus(out);
		try {
			ctx.ui.setTitle(title);
		} catch {
			// host may not support setTitle
		}
		try {
			ctx.ui.setStatus(STATUS_KEY, line);
		} catch {
			// ignore
		}
		try {
			// Widget above editor is always visible per pane, even when the
			// default footer doesn't render extension statuses.
			ctx.ui.setWidget(WIDGET_KEY, [line]);
		} catch {
			// ignore
		}
	};

	const recomputeAutoBadge = (ctx: ExtensionContext) => {
		const sessionFile = ctx.sessionManager.getSessionFile?.();
		const seed = sessionFile && sessionFile.length > 0 ? sessionFile : `pid:${process.pid}`;
		state.autoBadge = badgeFor(seed);
	};

	const restoreFromEntries = (ctx: ExtensionContext) => {
		for (const e of ctx.sessionManager.getEntries()) {
			const anyE = e as { type?: string; customType?: string; data?: Record<string, unknown> };
			if (anyE.type !== "custom" || anyE.customType !== PERSIST_TYPE) continue;
			const data = anyE.data ?? {};
			if (typeof data.summary === "string") state.cachedSummary = data.summary;
			if (typeof data.pinned === "string") state.pinnedSummary = data.pinned;
			else if (data.pinned === null) state.pinnedSummary = null;
			if (typeof data.pinnedBadgeEmoji === "string" && typeof data.pinnedBadgeColor === "number") {
				state.pinnedBadge = { emoji: data.pinnedBadgeEmoji, color: data.pinnedBadgeColor };
			} else if (data.pinnedBadgeEmoji === null) {
				state.pinnedBadge = null;
			}
		}
	};

	const persist = () => {
		try {
			pi.appendEntry(PERSIST_TYPE, {
				summary: state.cachedSummary,
				pinned: state.pinnedSummary,
				pinnedBadgeEmoji: state.pinnedBadge?.emoji ?? null,
				pinnedBadgeColor: state.pinnedBadge?.color ?? null,
				updatedAt: Date.now(),
			});
		} catch {
			// best-effort
		}
	};

	const ensureResolution = async (ctx: ExtensionContext): Promise<SummarizerResolution | null> => {
		if (state.resolution !== undefined) return state.resolution;
		const result = await resolveSummarizer(ctx, state.candidates);
		if (result.ok) {
			state.resolution = result.resolution;
			state.lastError = null;
			return result.resolution;
		}
		state.resolution = null;
		state.lastError = `no summarizer model usable (${result.tried.join(", ") || "no candidates"})`;
		return null;
	};

	const summarizeNow = async (ctx: ExtensionContext): Promise<void> => {
		if (state.pinnedSummary) {
			state.dirty = false;
			return;
		}
		const branch = ctx.sessionManager.getBranch();
		const leafId = ctx.sessionManager.getLeafId?.();
		if (!branch.length) {
			state.dirty = false;
			return;
		}
		if (leafId && leafId === state.lastSummarizedLeafId && !state.isWorking) {
			state.dirty = false;
			return;
		}
		const activity = extractActivityText(branch as never);
		if (!activity) {
			state.dirty = false;
			return;
		}
		const resolution = await ensureResolution(ctx);
		if (!resolution) {
			state.dirty = false;
			return;
		}

		state.inflight?.abort();
		const ac = new AbortController();
		state.inflight = ac;
		state.dirty = false;
		state.lastSummarizedLeafId = leafId ?? undefined;
		state.lastSummaryAt = Date.now();

		const result = await generateLiveSummary({ resolution, activity, signal: ac.signal });
		if (state.inflight === ac) state.inflight = null;
		if (ac.signal.aborted) return;

		if (result.ok) {
			state.cachedSummary = result.summary;
			state.summarizeCount += 1;
			state.lastError = null;
			applyOutputs(ctx);
		} else {
			state.lastError = result.reason;
		}
	};

	const startTimer = (ctx: ExtensionContext) => {
		if (timer) return;
		timer = setInterval(() => {
			if (!state.dirty) return;
			if (Date.now() - state.lastSummaryAt < MIN_SUMMARY_GAP_MS) return;
			void summarizeNow(ctx);
		}, SUMMARY_TICK_MS);
	};

	const stopTimer = () => {
		if (timer) {
			clearInterval(timer);
			timer = null;
		}
	};

	pi.on("session_start", async (_event, ctx) => {
		recomputeAutoBadge(ctx);
		restoreFromEntries(ctx);
		applyOutputs(ctx);
		state.dirty = true;
		startTimer(ctx);
		// Eagerly resolve so /live-summary surfaces auth errors immediately.
		void ensureResolution(ctx).then(() => applyOutputs(ctx));
	});

	pi.on("agent_start", async (_event, ctx) => {
		state.isWorking = true;
		state.dirty = true;
		applyOutputs(ctx);
		startTimer(ctx);
	});

	pi.on("agent_end", async (_event, ctx) => {
		state.isWorking = false;
		state.dirty = true;
		await summarizeNow(ctx);
		applyOutputs(ctx);
		persist();
	});

	pi.on("turn_end", async () => {
		state.dirty = true;
	});

	pi.on("tool_execution_end", async () => {
		state.dirty = true;
	});

	pi.on("model_select", async (_event, ctx) => {
		applyOutputs(ctx);
	});

	pi.on("session_shutdown", async () => {
		state.inflight?.abort();
		stopTimer();
	});

	pi.registerCommand("live-summary", {
		description: "Show/refresh/set the per-session live activity summary",
		handler: async (rawArgs, ctx) => {
			const args = rawArgs.trim();
			if (!args) {
				const out = toOutputState();
				const modelLabel = state.resolution
					? state.resolution.label
					: state.resolution === null
						? "(none — never resolved)"
						: "(not yet resolved)";
				const badge = state.pinnedBadge ?? state.autoBadge;
				ctx.ui.notify(
					[
						`title=${buildTitle(out)}`,
						`status=${buildStatus(out)}`,
						`model=${modelLabel}`,
						`badge=${badge.emoji}/${badge.color} (${state.pinnedBadge ? "pinned" : "auto"})`,
						`summarizeCount=${state.summarizeCount}`,
						`lastError=${state.lastError ?? "(none)"}`,
					].join(" | "),
					"info",
				);
				return;
			}

			const [sub, ...rest] = args.split(/\s+/);
			const remainder = rest.join(" ").trim();

			switch (sub) {
				case "refresh": {
					state.dirty = true;
					state.lastSummarizedLeafId = undefined;
					await summarizeNow(ctx);
					applyOutputs(ctx);
					const summary = state.pinnedSummary ?? state.cachedSummary;
					ctx.ui.notify(
						`Summary: ${summary || "(empty)"}${state.lastError ? " | err: " + state.lastError : ""}`,
						state.lastError ? "warning" : "info",
					);
					return;
				}
				case "set": {
					if (!remainder) {
						ctx.ui.notify("Usage: /live-summary set <text>", "warning");
						return;
					}
					state.pinnedSummary = remainder.slice(0, 80);
					applyOutputs(ctx);
					persist();
					ctx.ui.notify(`Pinned: ${state.pinnedSummary}`, "info");
					return;
				}
				case "clear": {
					state.pinnedSummary = null;
					state.dirty = true;
					applyOutputs(ctx);
					persist();
					ctx.ui.notify("Pinned summary cleared", "info");
					return;
				}
				case "badge": {
					if (!remainder) {
						const b = state.pinnedBadge ?? state.autoBadge;
						ctx.ui.notify(
							`Badge: ${b.emoji} (color ${b.color})${state.pinnedBadge ? " [pinned]" : " [auto]"}`,
							"info",
						);
						return;
					}
					if (remainder === "auto" || remainder === "reset") {
						state.pinnedBadge = null;
						applyOutputs(ctx);
						persist();
						ctx.ui.notify(`Badge auto: ${state.autoBadge.emoji}`, "info");
						return;
					}
					const parts = remainder.split(/\s+/);
					const emojiCp = Array.from(parts[0] ?? "")[0];
					if (!emojiCp) {
						ctx.ui.notify("Usage: /live-summary badge <emoji> [color256] | auto", "warning");
						return;
					}
					let color = state.autoBadge.color;
					if (parts[1]) {
						const n = Number.parseInt(parts[1], 10);
						if (Number.isFinite(n) && n >= 0 && n <= 255) color = n;
					}
					state.pinnedBadge = { emoji: emojiCp, color };
					applyOutputs(ctx);
					persist();
					ctx.ui.notify(`Badge pinned: ${emojiCp} (color ${color})`, "info");
					return;
				}
				case "model": {
					if (!remainder) {
						ctx.ui.notify("Usage: /live-summary model <provider>/<id>", "warning");
						return;
					}
					const slash = remainder.indexOf("/");
					if (slash <= 0) {
						ctx.ui.notify("Format must be <provider>/<id>", "warning");
						return;
					}
					state.candidates = [{ provider: remainder.slice(0, slash), id: remainder.slice(slash + 1) }];
					state.resolution = undefined;
					const next = await ensureResolution(ctx);
					if (!next) {
						ctx.ui.notify(
							`Model ${remainder} unavailable: ${state.lastError ?? "unknown"}`,
							"error",
						);
						state.candidates = DEFAULT_SUMMARIZER_CANDIDATES;
						state.resolution = undefined;
						return;
					}
					ctx.ui.notify(`Summarizer model: ${remainder}`, "info");
					return;
				}
				case "auto": {
					state.candidates = DEFAULT_SUMMARIZER_CANDIDATES;
					state.resolution = undefined;
					const next = await ensureResolution(ctx);
					ctx.ui.notify(
						next
							? `Auto-selected: ${next.label}`
							: `No summarizer model available: ${state.lastError ?? "unknown"}`,
						next ? "info" : "warning",
					);
					return;
				}
				default: {
					ctx.ui.notify(
						"Usage: /live-summary [refresh|set <text>|clear|badge <emoji>|badge auto|model <p/id>|auto]",
						"warning",
					);
				}
			}
		},
	});
}
