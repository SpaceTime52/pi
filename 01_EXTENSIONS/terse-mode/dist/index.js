// src/constants.ts
var ENTRY_TYPE = "terse-mode-state";
var STYLE_SECTION = "## Terse Response Style";
var STYLE_PROMPT = [
  "Respond tersely. Keep technical substance exact. Remove filler, pleasantries, and hedging.",
  "",
  "Prefer short sentences or fragments when clear. Use precise technical terms.",
  "Keep code blocks, commands, paths, URLs, and exact error text unchanged.",
  "",
  "Pattern: [thing] [action] [reason]. [next step].",
  "",
  "For security warnings, destructive actions, or ambiguous multi-step instructions, switch to explicit normal wording.",
  "Do not mention token savings, compression ratios, or caveman branding unless the user asks."
].join("\n");

// src/state.ts
var enabled = true;
function isEnabled() {
  return enabled;
}
function setEnabled(next) {
  const changed = enabled !== next;
  enabled = next;
  return changed;
}
function buildEntry(updatedAt = Date.now()) {
  return { enabled, updatedAt };
}
function restoreFromEntries(entries) {
  enabled = true;
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i];
    if (entry.type !== "custom" || entry.customType !== ENTRY_TYPE) continue;
    const restored = readEnabled(entry.data);
    if (restored === void 0) continue;
    enabled = restored;
    return enabled;
  }
  return enabled;
}
function readEnabled(value) {
  if (!isRecord(value)) return void 0;
  return typeof value.enabled === "boolean" ? value.enabled : void 0;
}
function isRecord(value) {
  return typeof value === "object" && value !== null;
}

// src/command.ts
function createTerseCommand(appendEntry) {
  return {
    description: "\uC9E7\uC740 \uC751\uB2F5 \uC2A4\uD0C0\uC77C \uC81C\uC5B4. \uC0AC\uC6A9\uBC95: /terse on|off|status|toggle",
    handler: async (args, ctx) => {
      const action = normalizeAction(args);
      if (action === "status") return notifyStatus(ctx.ui.notify.bind(ctx.ui));
      if (action === "on") return applyState(true, appendEntry, ctx.ui.notify.bind(ctx.ui));
      if (action === "off") return applyState(false, appendEntry, ctx.ui.notify.bind(ctx.ui));
      if (action === "toggle") return applyState(!isEnabled(), appendEntry, ctx.ui.notify.bind(ctx.ui));
      ctx.ui.notify("\uC0AC\uC6A9\uBC95: /terse on|off|status|toggle", "warning");
    }
  };
}
function normalizeAction(raw) {
  const trimmed = raw.trim().toLowerCase();
  return trimmed || "status";
}
function applyState(next, appendEntry, notify) {
  const changed = setEnabled(next);
  appendEntry(ENTRY_TYPE, buildEntry());
  if (!changed) return notify(next ? "terse mode \uC774\uBBF8 \uCF1C\uC838 \uC788\uC5B4." : "terse mode \uC774\uBBF8 \uAEBC\uC838 \uC788\uC5B4.", "info");
  notify(next ? "terse mode \uCF30\uC5B4." : "terse mode \uAED0\uC5B4.", "info");
}
function notifyStatus(notify) {
  notify(isEnabled() ? "terse mode \uD604\uC7AC \uCF1C\uC9D0." : "terse mode \uD604\uC7AC \uAEBC\uC9D0.", "info");
}

// src/handlers.ts
function onRestore() {
  return async (_event, ctx) => {
    restoreFromEntries(ctx.sessionManager.getBranch());
  };
}
function onBeforeAgentStart() {
  return async (event) => {
    if (!isEnabled()) return void 0;
    return {
      systemPrompt: `${event.systemPrompt}

${STYLE_SECTION}
${STYLE_PROMPT}`
    };
  };
}

// src/index.ts
function index_default(pi) {
  pi.registerCommand("terse", createTerseCommand(pi.appendEntry.bind(pi)));
  pi.on("session_start", onRestore());
  pi.on("session_tree", onRestore());
  pi.on("before_agent_start", onBeforeAgentStart());
}
export {
  index_default as default
};
