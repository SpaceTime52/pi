// src/bash-tool.ts
import { defineTool, createBashToolDefinition } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";

// src/tool-utils.ts
function toolPrefix(theme, label) {
  return `${theme.fg("accent", "\u25CF")} ${theme.fg("toolTitle", theme.bold(label))}`;
}
function summarizeTextPreview(theme, text, maxLines) {
  const lines = text.split("\n");
  const preview = lines.slice(0, maxLines).map((line) => theme.fg("toolOutput", line));
  if (lines.length > maxLines) preview.push(theme.fg("dim", `\u2026 ${lines.length - maxLines} more lines`));
  return preview.join("\n");
}

// src/bash-tool.ts
function createClaudeBashTool(cwd) {
  const base = createBashToolDefinition(cwd);
  return defineTool({
    ...base,
    renderCall(args, theme) {
      const command = args.command.length > 88 ? `${args.command.slice(0, 85)}\u2026` : args.command;
      return new Text(`${toolPrefix(theme, "Bash")} ${theme.fg("muted", command)}`, 0, 0);
    },
    renderResult(result, { expanded, isPartial }, theme) {
      if (isPartial) return new Text(theme.fg("warning", "running\u2026"), 0, 0);
      const first = result.content[0];
      const output = first?.type === "text" ? first.text : "";
      const exitCode = output.match(/exit code: (\d+)/)?.[1];
      let text = exitCode && exitCode !== "0" ? theme.fg("error", `exit ${exitCode}`) : theme.fg("success", "done");
      text += theme.fg("dim", ` \xB7 ${output.split("\n").filter((line) => line.trim()).length} lines`);
      if (result.details?.truncation?.truncated) text += theme.fg("dim", " \xB7 truncated");
      if (expanded && output.trim()) text += `
${summarizeTextPreview(theme, output, 18)}`;
      return new Text(text, 0, 0);
    }
  });
}

// src/edit-tool.ts
import { defineTool as defineTool2, createEditToolDefinition } from "@mariozechner/pi-coding-agent";
import { Text as Text2 } from "@mariozechner/pi-tui";
function renderDiffLine(theme, line) {
  if (line.startsWith("+") && !line.startsWith("+++")) return theme.fg("toolDiffAdded", line);
  if (line.startsWith("-") && !line.startsWith("---")) return theme.fg("toolDiffRemoved", line);
  return theme.fg("toolDiffContext", line);
}
function createClaudeEditTool(cwd) {
  const base = createEditToolDefinition(cwd);
  return defineTool2({
    ...base,
    renderCall(args, theme) {
      return new Text2(`${toolPrefix(theme, "Edit")} ${theme.fg("muted", args.path)}`, 0, 0);
    },
    renderResult(result, { expanded, isPartial }, theme) {
      if (isPartial) return new Text2(theme.fg("warning", "editing\u2026"), 0, 0);
      const content = result.content[0];
      if (content?.type === "text" && content.text.startsWith("Error")) return new Text2(theme.fg("error", content.text.split("\n")[0]), 0, 0);
      if (!result.details?.diff) return new Text2(theme.fg("success", "applied"), 0, 0);
      const diffLines = result.details.diff.split("\n");
      let text = theme.fg("success", `+${diffLines.filter((line) => line.startsWith("+") && !line.startsWith("+++")).length}`);
      text += theme.fg("dim", " \xB7 ") + theme.fg("error", `-${diffLines.filter((line) => line.startsWith("-") && !line.startsWith("---")).length}`);
      if (!expanded) return new Text2(text, 0, 0);
      const preview = diffLines.slice(0, 24).map((line) => renderDiffLine(theme, line));
      if (diffLines.length > 24) preview.push(theme.fg("dim", `\u2026 ${diffLines.length - 24} more diff lines`));
      return new Text2(`${text}
${preview.join("\n")}`, 0, 0);
    }
  });
}

// src/read-tool.ts
import { defineTool as defineTool3, createReadToolDefinition } from "@mariozechner/pi-coding-agent";
import { Text as Text3 } from "@mariozechner/pi-tui";
function createClaudeReadTool(cwd) {
  const base = createReadToolDefinition(cwd);
  return defineTool3({
    ...base,
    renderCall(args, theme) {
      return new Text3(`${toolPrefix(theme, "Read")} ${theme.fg("muted", args.path)}`, 0, 0);
    },
    renderResult(result, { expanded, isPartial }, theme) {
      if (isPartial) return new Text3(theme.fg("warning", "reading\u2026"), 0, 0);
      const content = result.content[0];
      if (content?.type !== "text") return new Text3(theme.fg("success", "loaded"), 0, 0);
      let text = theme.fg("success", `${content.text.split("\n").length} lines`);
      if (result.details?.truncation?.truncated) text += theme.fg("dim", ` \xB7 truncated from ${result.details.truncation.totalLines}`);
      if (expanded) text += `
${summarizeTextPreview(theme, content.text, 14)}`;
      return new Text3(text, 0, 0);
    }
  });
}

// src/editor.ts
import { CustomEditor } from "@mariozechner/pi-coding-agent";

// src/ansi.ts
var ANSI_RESET_FG = "\x1B[39m";
var ANSI_RE = /\x1b\[[0-9;]*m/g;
function colorizeRgb(text, rgb) {
  const [r, g, b] = rgb;
  return `\x1B[38;2;${r};${g};${b}m${text}${ANSI_RESET_FG}`;
}
function stripAnsi(text) {
  return text.replace(ANSI_RE, "");
}

// src/rules.ts
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
function buildChromeRule(width, label, borderColor) {
  const prefix = borderColor("\u2500\u2500");
  const labelPart = ` ${label} `;
  const suffixWidth = Math.max(0, width - visibleWidth(prefix) - visibleWidth(labelPart));
  const suffix = borderColor("\u2500".repeat(suffixWidth));
  return truncateToWidth(prefix + labelPart + suffix, width, "");
}
function findBottomRuleIndex(lines) {
  for (let i = lines.length - 1; i >= 0; i--) {
    const raw = stripAnsi(lines[i]);
    if (/^─+$/.test(raw) || /^─── ↓ \d+ more /.test(raw)) return i;
  }
  return -1;
}

// src/editor.ts
var ClaudeCodeEditor = class extends CustomEditor {
  constructor(tui, theme, keybindings, label, hint) {
    super(tui, theme, keybindings, { paddingX: 1 });
    this.label = label;
    this.hint = hint;
  }
  label;
  hint;
  render(width) {
    const lines = super.render(width);
    if (lines.length === 0) return lines;
    lines[0] = this.decorateTopBorder(lines[0], width);
    const bottomIndex = findBottomRuleIndex(lines);
    if (bottomIndex >= 0) lines[bottomIndex] = this.decorateBottomBorder(lines[bottomIndex], width);
    return lines;
  }
  decorateTopBorder(existing, width) {
    if (!/^─+$/.test(stripAnsi(existing))) return existing;
    return buildChromeRule(width, this.label("prompt"), this.borderColor);
  }
  decorateBottomBorder(existing, width) {
    if (!/^─+$/.test(stripAnsi(existing))) return existing;
    const label = this.label("enter send") + this.hint("  \xB7  shift+enter newline");
    return buildChromeRule(width, label, this.borderColor);
  }
};

// src/footer.ts
import { truncateToWidth as truncateToWidth3, visibleWidth as visibleWidth2 } from "@mariozechner/pi-tui";

// src/header.ts
import { truncateToWidth as truncateToWidth2 } from "@mariozechner/pi-tui";
import * as path from "node:path";
function getProjectName(ctx) {
  return path.basename(ctx.cwd) || ctx.cwd;
}
function createClaudeHeader(ctx) {
  const projectName = getProjectName(ctx);
  return (_tui, theme) => ({
    invalidate() {
    },
    render(width) {
      const line1 = `${theme.fg("accent", "\u273B")} ${theme.fg("text", theme.bold("pi"))}${theme.fg("dim", "  claude-code ui")}`;
      const line2 = `${theme.fg("muted", projectName)}${theme.fg("dim", "  \xB7  claude-code-dark")}`;
      return ["", truncateToWidth2(line1, width, ""), truncateToWidth2(line2, width, ""), ""];
    }
  });
}

// src/footer.ts
function formatCompactNumber(value) {
  if (value < 1e3) return `${value}`;
  if (value < 1e4) return `${(value / 1e3).toFixed(1)}k`;
  return `${Math.round(value / 1e3)}k`;
}
function getUsageTotals(ctx) {
  let inputTokens = 0;
  let outputTokens = 0;
  let totalCost = 0;
  for (const entry of ctx.sessionManager.getBranch()) {
    if (entry.type !== "message" || entry.message.role !== "assistant") continue;
    const message = entry.message;
    inputTokens += message.usage.input;
    outputTokens += message.usage.output;
    totalCost += message.usage.cost.total;
  }
  return { inputTokens, outputTokens, totalCost };
}
function createClaudeFooter(ctx) {
  const projectName = getProjectName(ctx);
  return (tui, theme, footerData) => ({
    dispose: footerData.onBranchChange(() => tui.requestRender()),
    invalidate() {
    },
    render(width) {
      const totals = getUsageTotals(ctx);
      const branch = footerData.getGitBranch();
      const usage = ctx.getContextUsage();
      const contextText = usage?.percent == null ? "ctx --" : `ctx ${Math.round(usage.percent)}%`;
      let left = `${theme.fg("accent", "\u273B")} ${theme.fg("text", projectName)}`;
      if (branch) left += theme.fg("dim", ` \xB7 ${branch}`);
      const rightParts = [
        theme.fg("muted", ctx.model?.id ?? "no-model"),
        theme.fg("dim", contextText),
        theme.fg("dim", `\u2191${formatCompactNumber(totals.inputTokens)} \u2193${formatCompactNumber(totals.outputTokens)}`),
        theme.fg("dim", `$${totals.totalCost.toFixed(3)}`)
      ];
      const right = rightParts.join(theme.fg("dim", " \xB7 "));
      const gap = Math.max(1, width - visibleWidth2(left) - visibleWidth2(right));
      return [truncateToWidth3(left + " ".repeat(gap) + right, width, "")];
    }
  });
}

// src/indicator.ts
var CLAUDE_ORANGE = [215, 119, 87];
var CLAUDE_ORANGE_SOFT = [235, 159, 127];
var CLAUDE_BLUE = [177, 185, 249];
var WORKING_INDICATOR = {
  frames: [
    colorizeRgb("\u273B", CLAUDE_ORANGE),
    colorizeRgb("\u2726", CLAUDE_BLUE),
    colorizeRgb("\u25CF", CLAUDE_ORANGE_SOFT),
    colorizeRgb("\u2726", CLAUDE_BLUE)
  ],
  intervalMs: 110
};

// src/theme.ts
var THEME_NAME = "claude-code-dark";
function applyClaudeTheme(ctx) {
  const result = ctx.ui.setTheme(THEME_NAME);
  return {
    themeName: THEME_NAME,
    success: result.success,
    error: result.error
  };
}

// src/chrome.ts
function applyClaudeChrome(ctx) {
  const themeResult = applyClaudeTheme(ctx);
  ctx.ui.setHeader(createClaudeHeader(ctx));
  ctx.ui.setFooter(createClaudeFooter(ctx));
  ctx.ui.setEditorComponent(
    (tui, theme, keybindings) => new ClaudeCodeEditor(
      tui,
      theme,
      keybindings,
      (text) => ctx.ui.theme.fg("accent", ctx.ui.theme.bold(text)),
      (text) => ctx.ui.theme.fg("dim", text)
    )
  );
  ctx.ui.setWorkingIndicator(WORKING_INDICATOR);
  ctx.ui.setHiddenThinkingLabel("thinking");
  ctx.ui.setTitle(`pi \xB7 ${getProjectName(ctx)}`);
  if (!themeResult.success) {
    ctx.ui.notify(
      `Claude UI applied, but theme switch failed: ${themeResult.error ?? "unknown error"}`,
      "warning"
    );
  }
}

// src/session-start.ts
async function onSessionStart(_event, ctx) {
  if (!ctx.hasUI) return;
  applyClaudeChrome(ctx);
}

// src/write-tool.ts
import { defineTool as defineTool4, createWriteToolDefinition } from "@mariozechner/pi-coding-agent";
import { Text as Text4 } from "@mariozechner/pi-tui";
function createClaudeWriteTool(cwd) {
  const base = createWriteToolDefinition(cwd);
  return defineTool4({
    ...base,
    renderCall(args, theme) {
      const suffix = theme.fg("dim", ` \xB7 ${args.content.split("\n").length} lines`);
      return new Text4(`${toolPrefix(theme, "Write")} ${theme.fg("muted", args.path)}${suffix}`, 0, 0);
    },
    renderResult(result, { isPartial }, theme) {
      if (isPartial) return new Text4(theme.fg("warning", "writing\u2026"), 0, 0);
      const content = result.content[0];
      if (content?.type === "text" && content.text.startsWith("Error")) return new Text4(theme.fg("error", content.text.split("\n")[0]), 0, 0);
      return new Text4(theme.fg("success", "written"), 0, 0);
    }
  });
}

// src/index.ts
function index_default(_pi) {
  _pi.registerTool(createClaudeReadTool(process.cwd()));
  _pi.registerTool(createClaudeBashTool(process.cwd()));
  _pi.registerTool(createClaudeEditTool(process.cwd()));
  _pi.registerTool(createClaudeWriteTool(process.cwd()));
  _pi.on("session_start", onSessionStart);
}
export {
  index_default as default
};
