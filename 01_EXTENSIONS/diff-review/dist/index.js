var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// node_modules/glimpseui/src/follow-cursor-support.mjs
import { existsSync } from "node:fs";
import { dirname as dirname2, join as join3 } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";
function nativeBinaryExists() {
  return existsSync(join3(__dirname, "glimpse"));
}
function env(name) {
  return (process.env[name] || "").toLowerCase();
}
function hyprlandSocketExists() {
  const signature = process.env.HYPRLAND_INSTANCE_SIGNATURE;
  if (!signature) return false;
  const candidates = [];
  if (process.env.XDG_RUNTIME_DIR) {
    candidates.push(join3(process.env.XDG_RUNTIME_DIR, "hypr", signature, ".socket.sock"));
  }
  if (process.env.UID) {
    candidates.push(join3("/run/user", process.env.UID, "hypr", signature, ".socket.sock"));
  }
  candidates.push(join3("/tmp", "hypr", signature, ".socket.sock"));
  return candidates.some((path) => existsSync(path));
}
function detect() {
  if (process.platform === "darwin") {
    return { supported: true, reason: null };
  }
  if (process.platform === "win32") {
    return { supported: true, reason: null };
  }
  if (process.platform !== "linux") {
    return { supported: false, reason: `unsupported platform: ${process.platform}` };
  }
  const sessionType = env("XDG_SESSION_TYPE");
  const desktop = [env("XDG_CURRENT_DESKTOP"), env("DESKTOP_SESSION")].filter(Boolean).join(" ");
  const isHyprland = Boolean(process.env.HYPRLAND_INSTANCE_SIGNATURE) || desktop.includes("hyprland");
  const isWayland = Boolean(process.env.WAYLAND_DISPLAY) || sessionType === "wayland";
  const isX11 = Boolean(process.env.DISPLAY) || sessionType === "x11";
  if (isHyprland) {
    return hyprlandSocketExists() ? { supported: true, reason: null } : { supported: false, reason: "Hyprland detected but its IPC socket was not found" };
  }
  const usingChromium = process.env.GLIMPSE_BACKEND === "chromium" || process.platform === "linux" && !nativeBinaryExists();
  if (isWayland && !usingChromium) {
    return { supported: false, reason: "Wayland follow-cursor is disabled without a compositor-specific backend" };
  }
  if (isX11) {
    if (usingChromium) {
      return { supported: true, reason: null };
    }
    return { supported: false, reason: "X11 follow-cursor backend is not implemented yet" };
  }
  return { supported: false, reason: "No supported follow-cursor backend detected" };
}
function getFollowCursorSupport() {
  if (!cached) cached = detect();
  return cached;
}
function supportsFollowCursor() {
  return getFollowCursorSupport().supported;
}
var __dirname, cached;
var init_follow_cursor_support = __esm({
  "node_modules/glimpseui/src/follow-cursor-support.mjs"() {
    __dirname = dirname2(fileURLToPath2(import.meta.url));
    cached = null;
  }
});

// node_modules/glimpseui/src/glimpse.mjs
var glimpse_exports = {};
__export(glimpse_exports, {
  getFollowCursorSupport: () => getFollowCursorSupport,
  getNativeHostInfo: () => getNativeHostInfo,
  open: () => open,
  prompt: () => prompt,
  statusItem: () => statusItem,
  supportsFollowCursor: () => supportsFollowCursor
});
import { EventEmitter } from "node:events";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { existsSync as existsSync2, readFileSync as readFileSync2 } from "node:fs";
import { dirname as dirname3, isAbsolute, join as join4, normalize, resolve } from "node:path";
import { fileURLToPath as fileURLToPath3 } from "node:url";
function resolveChromiumBackend() {
  return {
    path: process.execPath,
    extraArgs: [join4(__dirname2, "chromium-backend.mjs")],
    platform: "linux-chromium",
    buildHint: "Using system Chromium via CDP (no native binary needed)"
  };
}
function resolveNativeHost() {
  const override = process.env.GLIMPSE_BINARY_PATH || process.env.GLIMPSE_HOST_PATH;
  if (override) {
    return {
      path: isAbsolute(override) ? override : resolve(process.cwd(), override),
      platform: "override",
      buildHint: `Using override: ${override}`
    };
  }
  switch (process.platform) {
    case "darwin":
      return {
        path: join4(__dirname2, "glimpse"),
        platform: "darwin",
        buildHint: "Run 'npm run build:macos' or 'swiftc -O src/glimpse.swift -o src/glimpse'"
      };
    case "linux": {
      const backend = process.env.GLIMPSE_BACKEND;
      if (backend === "chromium") return resolveChromiumBackend();
      const nativePath = join4(__dirname2, "glimpse");
      if (backend === "native" || existsSync2(nativePath)) {
        return {
          path: nativePath,
          platform: "linux",
          buildHint: "Run 'npm run build:linux' (requires Rust toolchain and GTK4/WebKitGTK dev packages)"
        };
      }
      return resolveChromiumBackend();
    }
    case "win32":
      return {
        path: normalize(join4(__dirname2, "..", "native", "windows", "bin", "glimpse.exe")),
        platform: "win32",
        buildHint: "Run 'npm run build:windows' (requires .NET 8 SDK and WebView2 Runtime)"
      };
    default:
      throw new Error(`Unsupported platform: ${process.platform}. Glimpse supports macOS, Linux, and Windows.`);
  }
}
function getNativeHostInfo() {
  return resolveNativeHost();
}
function ensureBinary() {
  const host = resolveNativeHost();
  if (host.platform === "linux-chromium") return host;
  if (!existsSync2(host.path)) {
    const skippedBuildPath = join4(__dirname2, "..", ".glimpse-build-skipped");
    const skippedReason = existsSync2(skippedBuildPath) ? readFileSync2(skippedBuildPath, "utf8").trim() : null;
    throw new Error(
      skippedReason ? `Glimpse host not found at '${host.path}'. ${skippedReason}` : `Glimpse host not found at '${host.path}'. ${host.buildHint}`
    );
  }
  return host;
}
function open(html, options = {}) {
  const host = ensureBinary();
  const args = [];
  if (options.width != null) args.push("--width", String(options.width));
  if (options.height != null) args.push("--height", String(options.height));
  if (options.title != null) args.push("--title", options.title);
  if (options.frameless) args.push("--frameless");
  if (options.floating) args.push("--floating");
  if (options.transparent) args.push("--transparent");
  if (options.clickThrough) args.push("--click-through");
  if (options.hidden) args.push("--hidden");
  if (options.autoClose) args.push("--auto-close");
  const supportsOpenLinks = host.platform === "darwin" || host.platform === "override";
  if (options.openLinks && supportsOpenLinks) args.push("--open-links");
  if (options.openLinksApp && supportsOpenLinks) args.push("--open-links-app", options.openLinksApp);
  if (options.followCursor && supportsFollowCursor()) {
    args.push("--follow-cursor");
  } else if (options.followCursor) {
    const { reason } = getFollowCursorSupport();
    process.emitWarning(`followCursor disabled: ${reason}`, { code: "GLIMPSE_FOLLOW_CURSOR_UNSUPPORTED" });
  }
  if (options.x != null) args.push(`--x=${options.x}`);
  if (options.y != null) args.push(`--y=${options.y}`);
  if (options.cursorOffset?.x != null) args.push(`--cursor-offset-x=${options.cursorOffset.x}`);
  if (options.cursorOffset?.y != null) args.push(`--cursor-offset-y=${options.cursorOffset.y}`);
  if (options.cursorAnchor) args.push("--cursor-anchor", options.cursorAnchor);
  if (options.followMode != null) args.push("--follow-mode", options.followMode);
  const spawnArgs = [...host.extraArgs || [], ...args];
  const proc = spawn(host.path, spawnArgs, {
    stdio: ["pipe", "pipe", "inherit"],
    windowsHide: process.platform === "win32"
  });
  return new GlimpseWindow(proc, html);
}
function statusItem(html, options = {}) {
  const host = ensureBinary();
  if (host.platform !== "darwin" && host.platform !== "linux-chromium") {
    throw new Error(`statusItem() is only supported on macOS and Linux/Chromium (current platform: ${host.platform})`);
  }
  const args = ["--status-item"];
  if (options.width != null) args.push("--width", String(options.width));
  if (options.height != null) args.push("--height", String(options.height));
  if (options.title != null) args.push("--title", options.title);
  const spawnArgs = [...host.extraArgs || [], ...args];
  const proc = spawn(host.path, spawnArgs, { stdio: ["pipe", "pipe", "inherit"] });
  return new GlimpseStatusItem(proc, html);
}
function prompt(html, options = {}) {
  return new Promise((resolve2, reject) => {
    const win = open(html, { ...options, autoClose: true });
    let resolved = false;
    const timer = options.timeout ? setTimeout(() => {
      if (!resolved) {
        resolved = true;
        win.close();
        reject(new Error("Prompt timed out"));
      }
    }, options.timeout) : null;
    win.once("message", (data) => {
      if (!resolved) {
        resolved = true;
        if (timer) clearTimeout(timer);
        resolve2(data);
      }
    });
    win.once("closed", () => {
      if (timer) clearTimeout(timer);
      if (!resolved) {
        resolved = true;
        resolve2(null);
      }
    });
    win.once("error", (err) => {
      if (timer) clearTimeout(timer);
      if (!resolved) {
        resolved = true;
        reject(err);
      }
    });
  });
}
var __dirname2, GlimpseWindow, GlimpseStatusItem;
var init_glimpse = __esm({
  "node_modules/glimpseui/src/glimpse.mjs"() {
    init_follow_cursor_support();
    __dirname2 = dirname3(fileURLToPath3(import.meta.url));
    GlimpseWindow = class extends EventEmitter {
      #proc;
      #closed = false;
      #pendingHTML = null;
      #info = null;
      constructor(proc, initialHTML) {
        super();
        this.#proc = proc;
        this.#pendingHTML = initialHTML;
        proc.stdin.on("error", () => {
        });
        const rl = createInterface({ input: proc.stdout, crlfDelay: Infinity });
        rl.on("line", (line) => {
          let msg;
          try {
            msg = JSON.parse(line);
          } catch {
            this.emit("error", new Error(`Malformed protocol line: ${line}`));
            return;
          }
          switch (msg.type) {
            case "ready": {
              const info = { screen: msg.screen, screens: msg.screens, appearance: msg.appearance, cursor: msg.cursor, cursorTip: msg.cursorTip ?? null };
              this.#info = info;
              if (this.#pendingHTML) {
                this.setHTML(this.#pendingHTML);
                this.#pendingHTML = null;
              } else {
                this.emit("ready", info);
              }
              break;
            }
            case "info":
              this.#info = { screen: msg.screen, screens: msg.screens, appearance: msg.appearance, cursor: msg.cursor, cursorTip: msg.cursorTip ?? null };
              this.emit("info", this.#info);
              break;
            case "message":
              this.emit("message", msg.data);
              break;
            case "click":
              this.emit("click");
              break;
            case "closed":
              if (!this.#closed) {
                this.#closed = true;
                this.emit("closed");
              }
              break;
            default:
              break;
          }
        });
        proc.on("error", (err) => this.emit("error", err));
        proc.on("exit", () => {
          if (!this.#closed) {
            this.#closed = true;
            this.emit("closed");
          }
        });
      }
      #write(obj) {
        if (this.#closed) return;
        this.#proc.stdin.write(JSON.stringify(obj) + "\n");
      }
      /** @internal — for subclass use only */
      _write(obj) {
        this.#write(obj);
      }
      send(js) {
        this.#write({ type: "eval", js });
      }
      setHTML(html) {
        this.#write({ type: "html", html: Buffer.from(html).toString("base64") });
      }
      show(options = {}) {
        const msg = { type: "show" };
        if (options.title != null) msg.title = options.title;
        this.#write(msg);
      }
      close() {
        this.#write({ type: "close" });
      }
      loadFile(path) {
        this.#write({ type: "file", path });
      }
      get info() {
        return this.#info;
      }
      getInfo() {
        this.#write({ type: "get-info" });
      }
      followCursor(enabled, anchor, mode) {
        if (enabled && !supportsFollowCursor()) {
          const { reason } = getFollowCursorSupport();
          process.emitWarning(`followCursor disabled: ${reason}`, { code: "GLIMPSE_FOLLOW_CURSOR_UNSUPPORTED" });
          return;
        }
        const msg = { type: "follow-cursor", enabled };
        if (anchor !== void 0) msg.anchor = anchor;
        if (mode !== void 0) msg.mode = mode;
        this.#write(msg);
      }
    };
    GlimpseStatusItem = class extends GlimpseWindow {
      setTitle(title) {
        this._write({ type: "title", title });
      }
      resize(width, height) {
        this._write({ type: "resize", width, height });
      }
    };
  }
});

// lib/git-base.ts
async function runGitAllowFailure(pi, cwd, args) {
  const result = await pi.exec("git", args, { cwd });
  return result.code === 0 ? result.stdout.trim() : "";
}
async function currentBranch(pi, cwd) {
  return await runGitAllowFailure(pi, cwd, ["branch", "--show-current"]) || "HEAD";
}
async function getRepoRoot(pi, cwd) {
  const result = await pi.exec("git", ["rev-parse", "--show-toplevel"], { cwd });
  if (result.code !== 0) throw new Error("Not inside a git repository.");
  return result.stdout.trim();
}
async function hasHead(pi, cwd) {
  return (await pi.exec("git", ["rev-parse", "--verify", "HEAD"], { cwd })).code === 0;
}
async function findReviewBase(pi, cwd) {
  const branch = await currentBranch(pi, cwd);
  const upstream = await runGitAllowFailure(pi, cwd, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]);
  const originHead = await runGitAllowFailure(pi, cwd, ["symbolic-ref", "refs/remotes/origin/HEAD", "--short"]);
  const candidates = [upstream, originHead, "origin/main", "origin/master", "origin/develop", "main", "master", "develop"];
  for (const candidate of new Set(candidates.filter(Boolean))) {
    if (candidate === branch || candidate.endsWith(`/${branch}`)) continue;
    const mergeBase = await runGitAllowFailure(pi, cwd, ["merge-base", "HEAD", candidate]);
    if (mergeBase) return { baseRef: candidate, mergeBase };
  }
  return null;
}
async function listCommits(pi, cwd, range) {
  return runGitAllowFailure(pi, cwd, ["log", "-100", "--format=%H%x1f%h%x1f%s%x1f%an%x1f%aI", range]);
}

// lib/git-parse.ts
function isReviewablePath(path) {
  const lower = path.toLowerCase();
  return !lower.endsWith(".min.js") && !lower.endsWith(".min.css");
}
function toStatus(code) {
  if (code === "M") return "modified";
  if (code === "A") return "added";
  if (code === "D") return "deleted";
  if (code === "R") return "renamed";
  return null;
}
function parseNameStatus(output) {
  return output.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean).flatMap((line) => {
    const [rawCode, first, second] = line.split("	");
    const status = toStatus((rawCode ?? "")[0] ?? "");
    const path = status === "renamed" ? second ?? "" : first ?? "";
    if (!status || !path || !isReviewablePath(path)) return [];
    return [{
      id: `${status}:${first ?? ""}:${second ?? ""}`,
      path,
      status,
      oldPath: status === "added" ? null : first ?? null,
      newPath: status === "deleted" ? null : status === "renamed" ? second ?? null : first ?? null,
      present: status !== "deleted"
    }];
  }).sort((a, b) => a.path.localeCompare(b.path));
}

// lib/git-review-data.ts
var WORKING_TREE_SHA = "__pi_working_tree__";
async function runBashAllowFailure(pi, cwd, script) {
  const result = await pi.exec("bash", ["-lc", script], { cwd });
  return result.code === 0 ? result.stdout : "";
}
async function workingTreeStatus(pi, cwd) {
  return (await pi.exec("git", ["status", "--porcelain=1", "--untracked-files=all"], { cwd })).stdout.trim().length > 0;
}
function parseCommits(output) {
  return output.split(/\r?\n/u).filter(Boolean).map((line) => {
    const [sha, shortSha, subject, author, date] = line.split("");
    return { sha, shortSha, subject, author, date, kind: "commit" };
  });
}
function snapshotScript(base) {
  return [
    "set -euo pipefail",
    'tmp=$(mktemp "/tmp/pi-diff-review-index.XXXXXX")',
    `trap 'rm -f "$tmp"' EXIT`,
    'export GIT_INDEX_FILE="$tmp"',
    ...base ? [`git read-tree '${base}'`] : ['rm -f "$tmp"'],
    "git add -A -- .",
    base ? `git diff --cached --find-renames -M --name-status '${base}' --` : "git diff --cached --find-renames -M --name-status --root --"
  ].join("\n");
}
async function getReviewData(pi, cwd) {
  const repoRoot = await getRepoRoot(pi, cwd);
  const repoHasHead = await hasHead(pi, repoRoot);
  const reviewBase = repoHasHead ? await findReviewBase(pi, repoRoot) : null;
  const mergeBase = reviewBase?.mergeBase ?? (repoHasHead ? "HEAD" : null);
  const files = parseNameStatus(await runBashAllowFailure(pi, repoRoot, snapshotScript(mergeBase)));
  const range = reviewBase ? `${reviewBase.mergeBase}..HEAD` : repoHasHead ? "HEAD" : "";
  const commits = range ? parseCommits(await listCommits(pi, repoRoot, range)) : [];
  const workingCommit = await workingTreeStatus(pi, repoRoot);
  return {
    repoRoot,
    baseRef: reviewBase?.baseRef ?? null,
    mergeBase,
    hasHead: repoHasHead,
    files,
    commits: workingCommit ? [{ sha: WORKING_TREE_SHA, shortSha: "WT", subject: "Uncommitted changes", author: "", date: "", kind: "working-tree" }, ...commits] : commits
  };
}

// lib/git-detail.ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// src/truncate.ts
function truncateText(text, maxLines = 400, maxChars = 6e4) {
  const clippedChars = text.length > maxChars ? `${text.slice(0, maxChars)}

[truncated by characters]` : text;
  const lines = clippedChars.split(/\r?\n/u);
  if (lines.length <= maxLines) return clippedChars;
  return `${lines.slice(0, maxLines).join("\n")}

[truncated by lines]`;
}

// lib/git-detail.ts
async function runBashAllowFailure2(pi, cwd, script) {
  const result = await pi.exec("bash", ["-lc", script], { cwd });
  return result.code === 0 ? result.stdout : "";
}
function snapshotDiffScript(base, path) {
  const target = path ? ` -- '${path.replace(/'/gu, `'\\''`)}'` : " --";
  const header = ["set -euo pipefail", 'tmp=$(mktemp "/tmp/pi-diff-review-index.XXXXXX")', `trap 'rm -f "$tmp"' EXIT`, 'export GIT_INDEX_FILE="$tmp"'];
  const readTree = base ? [`git read-tree '${base}'`] : ['rm -f "$tmp"'];
  const diff = base ? `git diff --cached --find-renames -M '${base}'${target}` : `git diff --cached --find-renames -M --root${target}`;
  return [...header, ...readTree, "git add -A -- .", diff].join("\n");
}
async function loadCurrentFile(repoRoot, file, data, pi) {
  const livePath = file.newPath ?? file.oldPath;
  if (livePath && file.present) return readFile(join(repoRoot, livePath), "utf8").catch(() => "");
  if (data.hasHead && file.oldPath) return runBashAllowFailure2(pi, repoRoot, `git show HEAD:'${file.oldPath.replace(/'/gu, `'\\''`)}'`);
  if (data.mergeBase && file.oldPath) return runBashAllowFailure2(pi, repoRoot, `git show '${data.mergeBase}:${file.oldPath.replace(/'/gu, `'\\''`)}'`);
  return "File is not present in the current working tree.";
}
async function loadReviewDetail(pi, data, tab, id) {
  if (tab === "commits") {
    const commit = data.commits.find((item) => item.sha === id);
    if (!commit) throw new Error("Unknown commit requested.");
    const content2 = commit.kind === "working-tree" ? await runBashAllowFailure2(pi, data.repoRoot, snapshotDiffScript(data.hasHead ? "HEAD" : null, null)) : await runBashAllowFailure2(pi, data.repoRoot, `git show --stat --patch --find-renames -M '${id}'`);
    return { title: `[commit] ${commit.shortSha} ${commit.subject}`.trim(), content: truncateText(content2 || "No diff available.") };
  }
  const file = data.files.find((item) => item.id === id);
  if (!file) throw new Error("Unknown file requested.");
  const title = `${tab === "branch" ? "[branch diff]" : "[current file]"} ${file.path}`;
  const content = tab === "branch" ? await runBashAllowFailure2(pi, data.repoRoot, snapshotDiffScript(data.mergeBase, file.path)) : await loadCurrentFile(data.repoRoot, file, data, pi);
  return { title, content: truncateText(content || "No content available.") };
}

// src/prompt.ts
function formatLabel(comment) {
  if (comment.tab === "branch") return `[branch diff] ${comment.label}`;
  if (comment.tab === "commits") return `[commit] ${comment.label}`;
  return `[current file] ${comment.label}`;
}
function hasReviewFeedback(payload) {
  return payload.overallComment.trim().length > 0 || payload.comments.some((comment) => comment.body.trim().length > 0);
}
function composeReviewPrompt(payload) {
  const lines = ["Please address the following diff review feedback", ""];
  const overall = payload.overallComment.trim();
  if (overall) lines.push(overall, "");
  payload.comments.filter((comment) => comment.body.trim()).forEach((comment, index) => {
    lines.push(`${index + 1}. ${formatLabel(comment)}`);
    lines.push(`   ${comment.body.trim()}`);
    lines.push("");
  });
  return lines.join("\n").trim();
}

// src/ui.ts
import { readFileSync } from "node:fs";
import { dirname, join as join2 } from "node:path";
import { fileURLToPath } from "node:url";
var here = dirname(fileURLToPath(import.meta.url));
var webDir = join2(here, "..", "web");
function escapeInline(value) {
  return value.replace(/</gu, "\\u003c").replace(/>/gu, "\\u003e").replace(/&/gu, "\\u0026");
}
function buildReviewHtml(data) {
  const html = readFileSync(join2(webDir, "index.html"), "utf8");
  const js = readFileSync(join2(webDir, "app.js"), "utf8");
  return html.replace('"__INLINE_DATA__"', escapeInline(JSON.stringify(data))).replace("__INLINE_JS__", js);
}

// lib/glimpse-window.ts
import { spawn as spawn2 } from "node:child_process";
import { EventEmitter as EventEmitter2 } from "node:events";
import { existsSync as existsSync3 } from "node:fs";
import { createInterface as createInterface2 } from "node:readline";
var QuietWindow = class extends EventEmitter2 {
  #proc;
  #closed = false;
  constructor(proc, html) {
    super();
    this.#proc = proc;
    createInterface2({ input: proc.stdout, crlfDelay: Infinity }).on("line", (line) => this.#onLine(line, html));
    proc.on("error", (error) => this.emit("error", error));
    proc.on("exit", () => this.#markClosed());
  }
  #onLine(line, html) {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return void this.emit("error", new Error(`Malformed glimpse line: ${line}`));
    }
    if (message.type === "ready") return void this.#write({ type: "html", html: Buffer.from(html).toString("base64") });
    if (message.type === "message") this.emit("message", message.data);
    if (message.type === "closed") this.#markClosed();
  }
  #markClosed() {
    if (!this.#closed) {
      this.#closed = true;
      this.emit("closed");
    }
  }
  #write(payload) {
    if (!this.#closed) this.#proc.stdin.write(`${JSON.stringify(payload)}
`);
  }
  send(js) {
    this.#write({ type: "eval", js });
  }
  close() {
    this.#write({ type: "close" });
  }
};
async function getNativeHost() {
  return (await Promise.resolve().then(() => (init_glimpse(), glimpse_exports))).getNativeHostInfo();
}
async function openQuietGlimpse(html, options = {}) {
  const host = await getNativeHost();
  if (!existsSync3(host.path)) throw new Error(`Glimpse host not found at '${host.path}'.${host.buildHint ? ` ${host.buildHint}` : ""}`);
  const args = [options.width && `--width=${options.width}`, options.height && `--height=${options.height}`, options.title && "--title", options.title].filter((value) => typeof value === "string");
  return new QuietWindow(spawn2(host.path, [...host.extraArgs ?? [], ...args], { stdio: ["pipe", "pipe", "pipe"], windowsHide: process.platform === "win32", env: { ...process.env, OS_ACTIVITY_MODE: process.env.OS_ACTIVITY_MODE ?? "disable" } }), html);
}

// lib/diff-review-core.ts
function isReviewWindowMessage(message) {
  return !!message && typeof message === "object" && "type" in message;
}
function appendPrompt(ctx, prompt2) {
  ctx.ui.pasteToEditor(`${ctx.ui.getEditorText().trim() ? "\n\n" : ""}${prompt2}`);
}
function send(window, message) {
  const payload = JSON.stringify(message).replace(/</gu, "\\u003c").replace(/>/gu, "\\u003e").replace(/&/gu, "\\u0026");
  window.send(`window.__diffReviewReceive(${payload});`);
}
function registerDiffReview(_pi) {
  let activeWindow = null;
  const ignored = /* @__PURE__ */ new WeakSet();
  const closeWindow = (suppress = false) => {
    if (!activeWindow) return;
    const window = activeWindow;
    activeWindow = null;
    if (suppress) ignored.add(window);
    window.close();
  };
  const handleCommand = async (_args, ctx) => {
    if (activeWindow) return void ctx.ui.notify("A diff review window is already open.", "warning");
    try {
      const data = await getReviewData(_pi, ctx.cwd);
      if (data.files.length === 0 && data.commits.length === 0) return void ctx.ui.notify("No reviewable changes found.", "info");
      const window = await openQuietGlimpse(buildReviewHtml(data), { width: 1500, height: 960, title: "pi diff review" });
      activeWindow = window;
      window.on("message", async (message) => {
        if (!isReviewWindowMessage(message)) return;
        if (message.type === "detail") {
          try {
            const detail = await loadReviewDetail(_pi, data, message.tab, message.id);
            send(window, { type: "detail-data", requestId: message.requestId, tab: message.tab, id: message.id, ...detail });
          } catch (error) {
            send(window, { type: "detail-error", requestId: message.requestId, tab: message.tab, id: message.id, message: error instanceof Error ? error.message : String(error) });
          }
          return;
        }
        if (message.type === "cancel") return void ctx.ui.notify("Diff review cancelled.", "info");
        if (!hasReviewFeedback(message)) return;
        appendPrompt(ctx, composeReviewPrompt(message));
        ctx.ui.notify("Appended diff review feedback to the editor.", "info");
      });
      window.on("closed", () => {
        if (activeWindow === window) activeWindow = null;
      });
      window.on("error", (error) => {
        if (!ignored.has(window)) ctx.ui.notify(`Diff review failed: ${error.message}`, "error");
      });
      ctx.ui.notify("Opened diff review window.", "info");
    } catch (error) {
      closeWindow(true);
      ctx.ui.notify(`Diff review failed: ${error instanceof Error ? error.message : String(error)}`, "error");
    }
  };
  _pi.registerCommand("diff-review", { description: "Open a native diff review window for the current repository", handler: handleCommand });
  _pi.on("session_shutdown", (_event, _ctx) => closeWindow(true));
}
export {
  registerDiffReview as default
};
