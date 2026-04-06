// src/footer.ts
import { truncateToWidth } from "@mariozechner/pi-tui";

// src/types.ts
var BAR_WIDTH = 10;
var DIRTY_CHECK_INTERVAL_MS = 3e3;
var NAME_STATUS_KEY = "session-name";
var STATUS_STYLE_MAP = {
  [NAME_STATUS_KEY]: (theme, text) => {
    const chip = ` ${theme.fg("text", text)} `;
    return theme.bg("selectedBg", chip);
  }
};

// src/utils.ts
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
function getFolderName(cwd) {
  const parts = cwd.split(/[\\/]/).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : cwd || "unknown";
}
function sanitizeStatusText(text) {
  return text.replace(/[\r\n\t]/g, " ").replace(/ +/g, " ").trim();
}
function styleStatus(theme, key, text) {
  const style = STATUS_STYLE_MAP[key];
  return style ? style(theme, text) : text;
}
async function getRepoName(cwd, exec) {
  const result = await exec("git", ["remote", "get-url", "origin"], { cwd });
  if (result.code !== 0 || !result.stdout?.trim()) return null;
  const url = result.stdout.trim();
  const match = url.match(/\/([^/]+?)(?:\.git)?$/);
  if (!match) return null;
  return match[1];
}
async function hasUncommittedChanges(cwd, exec) {
  const result = await exec("git", ["status", "--porcelain=1", "--untracked-files=normal"], { cwd });
  if (result.code !== 0) return false;
  return result.stdout.trim().length > 0;
}

// src/build.ts
import { visibleWidth } from "@mariozechner/pi-tui";
function buildFooterStatusEntries(ctx, footerData) {
  const statusEntries = Array.from(footerData.getExtensionStatuses().entries()).filter(([key]) => key !== NAME_STATUS_KEY).map(([key, text]) => [key, sanitizeStatusText(text)]).filter(([, text]) => Boolean(text));
  const sessionName = ctx.sessionManager.getSessionName();
  if (sessionName) {
    statusEntries.unshift([NAME_STATUS_KEY, sessionName]);
  }
  return statusEntries;
}
function buildFooterLineParts(theme, ctx, footerData, repoName, hasDirtyChanges, width) {
  const model = ctx.model?.id || "no-model";
  const usage = ctx.getContextUsage();
  const pct = clamp(Math.round(usage?.percent ?? 0), 0, 100);
  const filled = Math.round(pct / 100 * BAR_WIDTH);
  const bar = "#".repeat(filled) + "-".repeat(BAR_WIDTH - filled);
  const statusEntries = buildFooterStatusEntries(ctx, footerData);
  const statusTexts = statusEntries.map(([, text]) => text);
  const active = statusTexts.filter((s) => /research(ing)?/i.test(s)).length;
  const done = statusTexts.filter((s) => /(^|\s)(done|✓)(\s|$)/i.test(s)).length;
  const folder = getFolderName(ctx.sessionManager.getCwd());
  const displayName = repoName || folder;
  const branch = footerData.getGitBranch();
  const branchText = branch ?? "no-branch";
  const dirtyMark = branch && hasDirtyChanges ? theme.fg("warning", "*") : "";
  const left = theme.fg("dim", ` ${model}`) + theme.fg("muted", " \xB7 ") + theme.fg("accent", `${displayName} - `) + dirtyMark + theme.fg("accent", branchText);
  const mid = active > 0 ? theme.fg("accent", ` \u25C9 ${active} researching`) : done > 0 ? theme.fg("success", ` \u2713 ${done} done`) : "";
  const remaining = 100 - pct;
  const barColor = remaining <= 15 ? "error" : remaining <= 40 ? "warning" : "dim";
  const right = theme.fg(barColor, `[${bar}] ${pct}% `);
  const pad = " ".repeat(Math.max(1, width - visibleWidth(left) - visibleWidth(mid) - visibleWidth(right)));
  return { statusEntries, left, mid, right, pad };
}

// src/footer.ts
function installFooter(ctx, exec) {
  if (!ctx.hasUI) return;
  ctx.ui.setFooter((tui, theme, footerData) => {
    let hasDirtyChanges = false;
    let dirtyCheckInitialized = false;
    let dirtyCheckRunning = false;
    let disposed = false;
    let dirtyTimer;
    let repoName = null;
    const fetchRepoName = async () => {
      repoName = await getRepoName(ctx.sessionManager.getCwd(), exec);
      if (!disposed) tui.requestRender();
    };
    const refreshDirtyState = async () => {
      if (dirtyCheckRunning) return;
      const branch = footerData.getGitBranch();
      if (branch === null) {
        if (hasDirtyChanges || !dirtyCheckInitialized) {
          hasDirtyChanges = false;
          dirtyCheckInitialized = true;
          tui.requestRender();
        }
        return;
      }
      dirtyCheckRunning = true;
      try {
        const next = await hasUncommittedChanges(ctx.sessionManager.getCwd(), exec);
        if (disposed) return;
        if (!dirtyCheckInitialized || next !== hasDirtyChanges) {
          hasDirtyChanges = next;
          dirtyCheckInitialized = true;
          tui.requestRender();
        }
      } catch {
      } finally {
        dirtyCheckRunning = false;
      }
    };
    void fetchRepoName();
    void refreshDirtyState();
    dirtyTimer = setInterval(() => void refreshDirtyState(), DIRTY_CHECK_INTERVAL_MS);
    const unsubscribeBranch = footerData.onBranchChange(() => {
      tui.requestRender();
      void refreshDirtyState();
    });
    return {
      dispose() {
        disposed = true;
        unsubscribeBranch();
        if (dirtyTimer) {
          clearInterval(dirtyTimer);
          dirtyTimer = void 0;
        }
      },
      invalidate() {
      },
      render(width) {
        const { statusEntries, left, mid, right, pad } = buildFooterLineParts(
          theme,
          ctx,
          footerData,
          repoName,
          hasDirtyChanges,
          width
        );
        const lines = [truncateToWidth(left + mid + pad + right, width)];
        if (statusEntries.length > 0) {
          const delimiter = theme.fg("dim", " \xB7 ");
          const rendered = statusEntries.map(([key, text]) => styleStatus(theme, key, text));
          lines.push(truncateToWidth(` ${rendered.join(delimiter)}`, width));
        }
        return lines;
      }
    };
  });
}
function teardownFooter(ctx) {
  if (!ctx.hasUI) return;
  ctx.ui.setFooter(void 0);
}

// src/index.ts
function index_default(pi) {
  pi.on("session_start", async (_event, ctx) => installFooter(ctx, (c, a, o) => pi.exec(c, a, o)));
  pi.on("session_tree", async (_event, ctx) => installFooter(ctx, (c, a, o) => pi.exec(c, a, o)));
  pi.on("session_shutdown", async (_event, ctx) => teardownFooter(ctx));
}
export {
  index_default as default
};
