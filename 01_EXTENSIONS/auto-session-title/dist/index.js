// src/handlers.ts
import path from "node:path";

// src/title.ts
var DEFAULT_MAX_TITLE_LENGTH = 48;
function collapseWhitespace(text) {
  return text.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
}
function stripMarkdownNoise(text) {
  return text.replace(/```[\s\S]*?```/g, " ").replace(/`+/g, " ");
}
function firstMeaningfulLine(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.find((line) => !line.startsWith("```")) ?? "";
}
function stripListPrefix(text) {
  return text.replace(/^(?:[#>*-]+|\d+[.)])\s+/, "");
}
function stripWrappingPunctuation(text) {
  return text.replace(/^["'`“”‘’([{]+/, "").replace(/["'`“”‘’)}\].,!?;:]+$/u, "").trim();
}
function takeFirstSentence(text) {
  const match = text.match(/^(.{8,120}?)(?:[.!?。！？](?:\s|$))/u);
  return match?.[1] ?? text;
}
function truncateTitle(text, maxLength = DEFAULT_MAX_TITLE_LENGTH) {
  if (text.length <= maxLength) return text;
  const clipped = text.slice(0, maxLength + 1);
  const lastWordBreak = Math.max(
    clipped.lastIndexOf(" "),
    clipped.lastIndexOf(":"),
    clipped.lastIndexOf("-"),
    clipped.lastIndexOf("\u2014"),
    clipped.lastIndexOf(",")
  );
  const cutoff = lastWordBreak >= Math.floor(maxLength * 0.6) ? lastWordBreak : maxLength;
  return `${clipped.slice(0, cutoff).trimEnd()}\u2026`;
}
function deriveSessionTitle(input, maxLength = DEFAULT_MAX_TITLE_LENGTH) {
  const raw = input.trim();
  if (!raw) return void 0;
  if (raw.startsWith("/") || raw.startsWith("!")) return void 0;
  const cleaned = stripMarkdownNoise(raw);
  const primaryLine = firstMeaningfulLine(cleaned) || cleaned;
  const flattened = collapseWhitespace(stripListPrefix(primaryLine));
  if (!flattened) return void 0;
  const sentence = stripWrappingPunctuation(takeFirstSentence(flattened));
  const candidate = sentence.length >= 3 ? sentence : stripWrappingPunctuation(flattened);
  const title = truncateTitle(candidate, maxLength).trim();
  return title || void 0;
}

// src/handlers.ts
function hasUserMessages(ctx) {
  return ctx.sessionManager.getEntries().some((entry) => entry.type === "message" && entry.message.role === "user");
}
function buildTerminalTitle(cwd, sessionName) {
  const cwdBasename = path.basename(cwd) || cwd;
  return `\u03C0 - ${sessionName} - ${cwdBasename}`;
}
async function handleInput(pi, event, ctx) {
  if (event.source === "extension") return;
  if (pi.getSessionName() || ctx.sessionManager.getSessionName()) return;
  if (hasUserMessages(ctx)) return;
  const title = deriveSessionTitle(event.text);
  if (!title) return;
  pi.setSessionName(title);
  if (ctx.hasUI) {
    ctx.ui.setTitle(buildTerminalTitle(ctx.cwd || ctx.sessionManager.getCwd(), title));
  }
}

// src/index.ts
function index_default(pi) {
  pi.on("input", async (event, ctx) => {
    await handleInput(pi, event, ctx);
  });
}
export {
  index_default as default
};
