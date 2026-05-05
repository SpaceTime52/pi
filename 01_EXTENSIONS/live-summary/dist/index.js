// src/index.ts
import path from "node:path";

// src/activity.ts
var MAX_ACTIVITY_CHARS = 2500;
var MAX_SUMMARY_CHARS = 24;
function extractActivityText(branch) {
  const recent = branch.slice(-6);
  const parts = [];
  for (const entry of recent) {
    if (entry.type !== "message" || !entry.message) continue;
    const role = entry.message.role;
    if (role !== "user" && role !== "assistant" && role !== "toolResult") continue;
    const content = entry.message.content;
    if (typeof content === "string") {
      parts.push(`${role}: ${content.slice(0, 600)}`);
      continue;
    }
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const block = part;
      if (block.type === "text" && typeof block.text === "string") {
        parts.push(`${role}: ${block.text.slice(0, 600)}`);
      } else if (block.type === "toolCall" && typeof block.name === "string") {
        const args = JSON.stringify(block.arguments ?? {});
        parts.push(`${role} tool=${block.name} args=${args.slice(0, 200)}`);
      }
    }
  }
  const joined = parts.join("\n").trim();
  if (joined.length <= MAX_ACTIVITY_CHARS) return joined;
  return joined.slice(joined.length - MAX_ACTIVITY_CHARS);
}
function trimSummary(raw) {
  const nl = raw.indexOf("\n");
  const firstLine = (nl >= 0 ? raw.slice(0, nl) : raw).trim();
  const stripped = firstLine.replace(/^[\s"'`。.]+|[\s"'`。.]+$/g, "");
  return Array.from(stripped).slice(0, MAX_SUMMARY_CHARS).join("");
}

// src/badge.ts
var BADGE_EMOJIS = [
  "\u{1F98A}",
  "\u{1F422}",
  "\u{1F427}",
  "\u{1F981}",
  "\u{1F42F}",
  "\u{1F98B}",
  "\u{1F419}",
  "\u{1F984}",
  "\u{1F41D}",
  "\u{1F43C}",
  "\u{1F428}",
  "\u{1F438}",
  "\u{1F99C}",
  "\u{1F992}",
  "\u{1F998}",
  "\u{1F9A6}",
  "\u{1F43A}",
  "\u{1F43B}",
  "\u{1F430}",
  "\u{1F994}",
  "\u{1F42E}",
  "\u{1F42D}",
  "\u{1F439}",
  "\u{1F431}",
  "\u{1F99D}",
  "\u{1F9A8}",
  "\u{1F9A5}",
  "\u{1F433}",
  "\u{1F993}",
  "\u{1F40C}",
  "\u{1F9A9}",
  "\u{1F41E}"
];
var BADGE_COLORS_256 = [
  39,
  45,
  51,
  81,
  117,
  75,
  33,
  27,
  201,
  207,
  213,
  219,
  165,
  197,
  161,
  198,
  220,
  214,
  208,
  202,
  196,
  178,
  154,
  118,
  82,
  46,
  50,
  226,
  215,
  141,
  99,
  105
];
var STATUS_COLOR_WORKING = 46;
var STATUS_COLOR_IDLE = 244;
function hashStr(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h << 5) + h + s.charCodeAt(i) | 0;
  return h >>> 0;
}
function badgeFor(seed) {
  const h = hashStr(seed);
  return {
    emoji: BADGE_EMOJIS[h % BADGE_EMOJIS.length],
    color: BADGE_COLORS_256[h % BADGE_COLORS_256.length]
  };
}
function colorize256(text, color) {
  return `\x1B[38;5;${color}m${text}\x1B[39m`;
}

// src/output.ts
function buildTitle(state) {
  const summary = state.pinnedSummary ?? state.cachedSummary;
  const head = summary || state.sessionName || `\u03C0 \xB7 ${state.cwdBasename}`;
  const emoji = (state.pinnedBadge ?? state.autoBadge).emoji;
  return `${emoji} ${head} \xB7 ${state.cwdBasename}`;
}
function buildStatus(state) {
  const summary = state.pinnedSummary ?? state.cachedSummary;
  let prefix;
  if (state.pinnedSummary) {
    prefix = "\u{1F4CC}";
  } else if (state.pinnedBadge) {
    prefix = colorize256(state.pinnedBadge.emoji, state.pinnedBadge.color);
  } else {
    const color = state.isWorking ? STATUS_COLOR_WORKING : STATUS_COLOR_IDLE;
    prefix = colorize256("\u25CF", color);
  }
  return summary ? `${prefix} ${summary}` : `${prefix} \u2026`;
}

// src/summarizer.ts
import { completeSimple } from "@mariozechner/pi-ai";

// src/prompt.ts
var SUMMARY_SYSTEM_PROMPT = "You compress a coding-agent session activity log into a tiny Korean status label. Output a single line only.";
function buildSummaryPrompt(activity) {
  return `\uB2E4\uC74C\uC740 \uCF54\uB529 \uC5D0\uC774\uC804\uD2B8 \uC138\uC158\uC758 \uCD5C\uADFC \uD65C\uB3D9 \uB85C\uADF8\uC57C.
\uC9C0\uAE08 \uC774 \uC138\uC158\uC774 "\uBB34\uC2A8 \uC77C\uC744 \uD558\uACE0 \uC788\uB294\uC9C0" \uD55C\uAD6D\uC5B4\uB85C 10~18\uC790 \uC774\uB0B4, \uC9E7\uC740 \uBA85\uC0AC\uAD6C\uB85C \uC694\uC57D\uD574.

\uADDC\uCE59:
- \uD615\uC2DD: "<\uC774\uBAA8\uC9C0 1\uAC1C> <\uC9E7\uC740 \uD55C\uAD6D\uC5B4 \uBA85\uC0AC\uAD6C>"
- \uC608: "\u{1F527} PR \uD2B8\uB798\uCEE4 \uC791\uC131", "\u{1F41E} \uC778\uC99D \uBC84\uADF8 \uC218\uC815", "\u{1F4DA} \uBB38\uC11C \uC815\uB9AC", "\u{1F9EA} \uD14C\uC2A4\uD2B8 \uCD94\uAC00"
- 18\uC790(\uC774\uBAA8\uC9C0 \uD3EC\uD568) \uC808\uB300 \uB118\uAE30\uC9C0 \uB9D0 \uAC83
- \uB530\uC634\uD45C\xB7\uB9C8\uCE68\uD45C\xB7\uC124\uBA85 \uAE08\uC9C0, \uACB0\uACFC\uB9CC \uD55C \uC904

<activity>
${activity}
</activity>`;
}

// src/summarizer.ts
var DEFAULT_SUMMARIZER_CANDIDATES = [
  { provider: "anthropic", id: "claude-haiku-4-5" },
  { provider: "anthropic", id: "claude-3-5-haiku-latest" },
  { provider: "openai-codex", id: "gpt-5.4-mini" },
  { provider: "openai-codex", id: "gpt-5.1-codex-mini" },
  { provider: "google", id: "gemini-2.5-flash" },
  { provider: "openai", id: "gpt-5-mini" },
  { provider: "openai", id: "gpt-4o-mini" }
];
async function resolveSummarizer(ctx, candidates = DEFAULT_SUMMARIZER_CANDIDATES) {
  const tried = [];
  const registry = ctx.modelRegistry;
  if (!registry) return { ok: false, tried: ["no-modelRegistry"] };
  for (const cand of candidates) {
    const label = `${cand.provider}/${cand.id}`;
    const model = registry.find(cand.provider, cand.id);
    if (!model) {
      tried.push(`${label}=missing`);
      continue;
    }
    const auth = await registry.getApiKeyAndHeaders(model).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      tried.push(`${label}=err:${msg.slice(0, 40)}`);
      return void 0;
    });
    if (!auth) continue;
    if (!auth.ok) {
      tried.push(`${label}=auth-fail`);
      continue;
    }
    return {
      ok: true,
      resolution: { model, apiKey: auth.apiKey, headers: auth.headers, label }
    };
  }
  return { ok: false, tried };
}
async function generateLiveSummary({
  resolution,
  activity,
  signal
}) {
  if (!activity.trim()) return { ok: false, reason: "empty activity" };
  let result;
  try {
    result = await completeSimple(
      resolution.model,
      {
        systemPrompt: SUMMARY_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: buildSummaryPrompt(activity) }],
            timestamp: Date.now()
          }
        ]
      },
      {
        apiKey: resolution.apiKey,
        headers: resolution.headers,
        signal,
        reasoning: "minimal",
        maxTokens: 64
      }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `complete: ${msg.slice(0, 80)}` };
  }
  if (result.stopReason !== "stop") return { ok: false, reason: `stopReason=${result.stopReason}` };
  const text = (result.content ?? []).filter((c) => c?.type === "text" && typeof c.text === "string").map((c) => c.text).join("");
  const trimmed = trimSummary(text);
  if (!trimmed) return { ok: false, reason: "empty summary" };
  return { ok: true, summary: trimmed };
}

// src/index.ts
var SUMMARY_TICK_MS = 5e3;
var MIN_SUMMARY_GAP_MS = 4e3;
var STATUS_KEY = "live-summary";
var WIDGET_KEY = "live-summary";
var PERSIST_TYPE = "live-summary";
function liveSummaryExtension(pi) {
  const state = {
    cachedSummary: "",
    pinnedSummary: null,
    pinnedBadge: null,
    autoBadge: badgeFor(`pid:${process.pid}`),
    isWorking: false,
    dirty: false,
    lastSummarizedLeafId: void 0,
    lastSummaryAt: 0,
    resolution: void 0,
    candidates: DEFAULT_SUMMARIZER_CANDIDATES,
    lastError: null,
    summarizeCount: 0,
    inflight: null
  };
  let timer = null;
  const toOutputState = () => ({
    cwdBasename: path.basename(process.cwd()) || "pi",
    sessionName: pi.getSessionName() || void 0,
    cachedSummary: state.cachedSummary,
    pinnedSummary: state.pinnedSummary,
    pinnedBadge: state.pinnedBadge,
    autoBadge: state.autoBadge,
    isWorking: state.isWorking
  });
  const applyOutputs = (ctx) => {
    if (!ctx.hasUI) return;
    const out = toOutputState();
    const title = buildTitle(out);
    const line = buildStatus(out);
    try {
      ctx.ui.setTitle(title);
    } catch {
    }
    try {
      ctx.ui.setStatus(STATUS_KEY, line);
    } catch {
    }
    try {
      ctx.ui.setWidget(WIDGET_KEY, [line]);
    } catch {
    }
  };
  const recomputeAutoBadge = (ctx) => {
    const sessionFile = ctx.sessionManager.getSessionFile?.();
    const seed = sessionFile && sessionFile.length > 0 ? sessionFile : `pid:${process.pid}`;
    state.autoBadge = badgeFor(seed);
  };
  const restoreFromEntries = (ctx) => {
    for (const e of ctx.sessionManager.getEntries()) {
      const anyE = e;
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
        updatedAt: Date.now()
      });
    } catch {
    }
  };
  const ensureResolution = async (ctx) => {
    if (state.resolution !== void 0) return state.resolution;
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
  const summarizeNow = async (ctx) => {
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
    const activity = extractActivityText(branch);
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
    state.lastSummarizedLeafId = leafId ?? void 0;
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
  const startTimer = (ctx) => {
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
        const modelLabel = state.resolution ? state.resolution.label : state.resolution === null ? "(none \u2014 never resolved)" : "(not yet resolved)";
        const badge = state.pinnedBadge ?? state.autoBadge;
        ctx.ui.notify(
          [
            `title=${buildTitle(out)}`,
            `status=${buildStatus(out)}`,
            `model=${modelLabel}`,
            `badge=${badge.emoji}/${badge.color} (${state.pinnedBadge ? "pinned" : "auto"})`,
            `summarizeCount=${state.summarizeCount}`,
            `lastError=${state.lastError ?? "(none)"}`
          ].join(" | "),
          "info"
        );
        return;
      }
      const [sub, ...rest] = args.split(/\s+/);
      const remainder = rest.join(" ").trim();
      switch (sub) {
        case "refresh": {
          state.dirty = true;
          state.lastSummarizedLeafId = void 0;
          await summarizeNow(ctx);
          applyOutputs(ctx);
          const summary = state.pinnedSummary ?? state.cachedSummary;
          ctx.ui.notify(
            `Summary: ${summary || "(empty)"}${state.lastError ? " | err: " + state.lastError : ""}`,
            state.lastError ? "warning" : "info"
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
              "info"
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
          state.resolution = void 0;
          const next = await ensureResolution(ctx);
          if (!next) {
            ctx.ui.notify(
              `Model ${remainder} unavailable: ${state.lastError ?? "unknown"}`,
              "error"
            );
            state.candidates = DEFAULT_SUMMARIZER_CANDIDATES;
            state.resolution = void 0;
            return;
          }
          ctx.ui.notify(`Summarizer model: ${remainder}`, "info");
          return;
        }
        case "auto": {
          state.candidates = DEFAULT_SUMMARIZER_CANDIDATES;
          state.resolution = void 0;
          const next = await ensureResolution(ctx);
          ctx.ui.notify(
            next ? `Auto-selected: ${next.label}` : `No summarizer model available: ${state.lastError ?? "unknown"}`,
            next ? "info" : "warning"
          );
          return;
        }
        default: {
          ctx.ui.notify(
            "Usage: /live-summary [refresh|set <text>|clear|badge <emoji>|badge auto|model <p/id>|auto]",
            "warning"
          );
        }
      }
    }
  });
}
export {
  liveSummaryExtension as default
};
