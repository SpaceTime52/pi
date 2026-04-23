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
import { dirname, join as join2 } from "node:path";
import { fileURLToPath } from "node:url";
function nativeBinaryExists() {
  return existsSync(join2(__dirname, "glimpse"));
}
function env(name) {
  return (process.env[name] || "").toLowerCase();
}
function hyprlandSocketExists() {
  const signature = process.env.HYPRLAND_INSTANCE_SIGNATURE;
  if (!signature) return false;
  const candidates = [];
  if (process.env.XDG_RUNTIME_DIR) {
    candidates.push(join2(process.env.XDG_RUNTIME_DIR, "hypr", signature, ".socket.sock"));
  }
  if (process.env.UID) {
    candidates.push(join2("/run/user", process.env.UID, "hypr", signature, ".socket.sock"));
  }
  candidates.push(join2("/tmp", "hypr", signature, ".socket.sock"));
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
    __dirname = dirname(fileURLToPath(import.meta.url));
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
import { existsSync as existsSync2, readFileSync } from "node:fs";
import { dirname as dirname2, isAbsolute, join as join3, normalize, resolve } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";
function resolveChromiumBackend() {
  return {
    path: process.execPath,
    extraArgs: [join3(__dirname2, "chromium-backend.mjs")],
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
        path: join3(__dirname2, "glimpse"),
        platform: "darwin",
        buildHint: "Run 'npm run build:macos' or 'swiftc -O src/glimpse.swift -o src/glimpse'"
      };
    case "linux": {
      const backend = process.env.GLIMPSE_BACKEND;
      if (backend === "chromium") return resolveChromiumBackend();
      const nativePath = join3(__dirname2, "glimpse");
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
        path: normalize(join3(__dirname2, "..", "native", "windows", "bin", "glimpse.exe")),
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
    const skippedBuildPath = join3(__dirname2, "..", ".glimpse-build-skipped");
    const skippedReason = existsSync2(skippedBuildPath) ? readFileSync(skippedBuildPath, "utf8").trim() : null;
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
    __dirname2 = dirname2(fileURLToPath2(import.meta.url));
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

// node_modules/@ryan_nookpi/pi-extension-diff-review/git.ts
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
var WORKING_TREE_COMMIT_SHA = "__pi_working_tree__";
var WORKING_TREE_COMMIT_SHORT_SHA = "WT";
var WORKING_TREE_COMMIT_SUBJECT = "Uncommitted changes";
function isWorkingTreeCommitSha(sha) {
  return sha === WORKING_TREE_COMMIT_SHA;
}
function createWorkingTreeCommitInfo() {
  return {
    sha: WORKING_TREE_COMMIT_SHA,
    shortSha: WORKING_TREE_COMMIT_SHORT_SHA,
    subject: WORKING_TREE_COMMIT_SUBJECT,
    authorName: "",
    authorDate: "",
    kind: "working-tree"
  };
}
async function runGitAllowFailure(pi, repoRoot, args) {
  const result = await pi.exec("git", args, { cwd: repoRoot });
  if (result.code !== 0) {
    return "";
  }
  return result.stdout;
}
async function runBashAllowFailure(pi, repoRoot, script) {
  const result = await pi.exec("bash", ["-lc", script], { cwd: repoRoot });
  if (result.code !== 0) {
    return "";
  }
  return result.stdout;
}
async function getRepoRoot(pi, cwd) {
  const result = await pi.exec("git", ["rev-parse", "--show-toplevel"], { cwd });
  if (result.code !== 0) {
    throw new Error("Not inside a git repository.");
  }
  return result.stdout.trim();
}
async function hasHead(pi, repoRoot) {
  const result = await pi.exec("git", ["rev-parse", "--verify", "HEAD"], { cwd: repoRoot });
  return result.code === 0;
}
async function currentBranch(pi, repoRoot) {
  const result = await pi.exec("git", ["branch", "--show-current"], { cwd: repoRoot });
  return result.code === 0 ? result.stdout.trim() || "HEAD" : "HEAD";
}
async function getUpstreamRef(pi, repoRoot) {
  const output = await runGitAllowFailure(pi, repoRoot, [
    "rev-parse",
    "--abbrev-ref",
    "--symbolic-full-name",
    "@{upstream}"
  ]);
  const value = output.trim();
  return value.length > 0 ? value : null;
}
async function getOriginHeadRef(pi, repoRoot) {
  const output = await runGitAllowFailure(pi, repoRoot, ["symbolic-ref", "refs/remotes/origin/HEAD", "--short"]);
  const value = output.trim();
  return value.length > 0 ? value : null;
}
function isSameBranchRef(ref, branch) {
  if (!branch || branch === "HEAD") return false;
  return ref === branch || ref.endsWith(`/${branch}`);
}
async function findReviewBase(pi, repoRoot) {
  const branch = await currentBranch(pi, repoRoot);
  const candidates = [];
  const upstreamRef = await getUpstreamRef(pi, repoRoot);
  if (upstreamRef && !isSameBranchRef(upstreamRef, branch)) {
    candidates.push(upstreamRef);
  }
  const originHeadRef = await getOriginHeadRef(pi, repoRoot);
  if (originHeadRef) {
    candidates.push(originHeadRef);
  }
  candidates.push("origin/main", "origin/master", "origin/develop", "main", "master", "develop");
  const seen = /* @__PURE__ */ new Set();
  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    const mergeBase = (await runGitAllowFailure(pi, repoRoot, ["merge-base", "HEAD", candidate])).trim();
    if (mergeBase.length > 0) {
      return { mergeBase, baseRef: candidate };
    }
  }
  return null;
}
function parseNameStatusLine(parts) {
  const code = (parts[0] ?? "")[0];
  if (code === "R") {
    const oldPath = parts[1] ?? null;
    const newPath = parts[2] ?? null;
    if (oldPath == null || newPath == null) return null;
    return { status: "renamed", oldPath, newPath };
  }
  const path = parts[1] ?? null;
  if (path == null) return null;
  if (code === "M") return { status: "modified", oldPath: path, newPath: path };
  if (code === "A") return { status: "added", oldPath: null, newPath: path };
  if (code === "D") return { status: "deleted", oldPath: path, newPath: null };
  return null;
}
function parseNameStatus(output) {
  const lines = output.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
  const changes = [];
  for (const line of lines) {
    const change = parseNameStatusLine(line.split("	"));
    if (change != null) changes.push(change);
  }
  return changes;
}
function parseStatusPorcelainZ(output) {
  const info = {
    hasChanges: false,
    hasReviewableChanges: false,
    hasUntracked: false,
    hasTrackedDeletions: false,
    hasRenames: false,
    untrackedPaths: []
  };
  const tokens = output.split("\0");
  for (let index = 0; index < tokens.length; ) {
    const token = tokens[index] ?? "";
    if (token.length === 0) {
      index += 1;
      continue;
    }
    const code = token.slice(0, 2);
    const path = token.slice(3);
    const isRenameOrCopy = code.includes("R") || code.includes("C");
    const isReviewablePath = code !== "!!" && path.length > 0 && isIncludedReviewPath(path);
    if (code !== "!!") {
      info.hasChanges = true;
    }
    if (isReviewablePath) {
      info.hasReviewableChanges = true;
    }
    if (code === "??") {
      if (isReviewablePath) {
        info.hasUntracked = true;
        info.untrackedPaths.push(path);
      }
    } else if (isReviewablePath) {
      if (code.includes("D")) info.hasTrackedDeletions = true;
      if (isRenameOrCopy) info.hasRenames = true;
    }
    index += isRenameOrCopy ? 2 : 1;
  }
  return info;
}
async function getWorkingTreeStatusInfo(pi, repoRoot) {
  const output = await runGitAllowFailure(pi, repoRoot, ["status", "--porcelain=1", "--untracked-files=all", "-z"]);
  return parseStatusPorcelainZ(output);
}
function toDisplayPath(change) {
  if (change.status === "renamed") {
    return `${change.oldPath ?? ""} -> ${change.newPath ?? ""}`;
  }
  return change.newPath ?? change.oldPath ?? "(unknown)";
}
function toComparison(change) {
  return {
    status: change.status,
    oldPath: change.oldPath,
    newPath: change.newPath,
    displayPath: toDisplayPath(change),
    hasOriginal: change.oldPath != null,
    hasModified: change.newPath != null
  };
}
function buildBranchFileId(path, hasWorkingTreeFile, gitDiff) {
  return ["branch", path, hasWorkingTreeFile ? "working" : "gone", gitDiff.displayPath].join("::");
}
function buildCommitFileId(sha, comparison) {
  return ["commit", sha, comparison.displayPath].join("::");
}
async function getRevisionContent(pi, repoRoot, revision, path) {
  const result = await pi.exec("git", ["show", `${revision}:${path}`], { cwd: repoRoot });
  if (result.code !== 0) {
    return "";
  }
  return result.stdout;
}
async function getWorkingTreeContent(repoRoot, path) {
  try {
    return await readFile(join(repoRoot, path), "utf8");
  } catch {
    return "";
  }
}
async function getWorkingTreeBytes(repoRoot, path) {
  try {
    return await readFile(join(repoRoot, path));
  } catch {
    return null;
  }
}
function shellQuote(value) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
async function getRevisionBytes(pi, repoRoot, revision, path) {
  const spec = shellQuote(`${revision}:${path}`);
  const result = await pi.exec("bash", ["-lc", `git show ${spec} | base64 | tr -d '\\n'`], { cwd: repoRoot });
  if (result.code !== 0) return null;
  const encoded = (result.stdout ?? "").trim();
  try {
    return Buffer.from(encoded, "base64");
  } catch {
    return null;
  }
}
var imageMimeTypes = /* @__PURE__ */ new Map([
  [".avif", "image/avif"],
  [".bmp", "image/bmp"],
  [".gif", "image/gif"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"]
]);
var binaryExtensions = /* @__PURE__ */ new Set([
  ".7z",
  ".a",
  ".avi",
  ".avif",
  ".bin",
  ".bmp",
  ".class",
  ".dll",
  ".dylib",
  ".eot",
  ".exe",
  ".gif",
  ".gz",
  ".ico",
  ".jar",
  ".jpeg",
  ".jpg",
  ".lockb",
  ".map",
  ".mov",
  ".mp3",
  ".mp4",
  ".o",
  ".otf",
  ".pdf",
  ".png",
  ".pyc",
  ".so",
  ".svgz",
  ".tar",
  ".ttf",
  ".wasm",
  ".webm",
  ".webp",
  ".woff",
  ".woff2",
  ".zip"
]);
function classifyFilePath(path) {
  const extension = extname(path.toLowerCase());
  const mimeType = imageMimeTypes.get(extension) ?? null;
  if (mimeType != null) return { kind: "image", mimeType };
  if (binaryExtensions.has(extension)) return { kind: "binary", mimeType: null };
  return { kind: "text", mimeType: null };
}
function isIncludedReviewPath(path) {
  const lowerPath = path.toLowerCase();
  const fileName = lowerPath.split("/").pop() ?? lowerPath;
  if (fileName.length === 0) return false;
  if (fileName.endsWith(".min.js") || fileName.endsWith(".min.css")) return false;
  return true;
}
function bufferToDataUrl(buffer, mimeType) {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}
function toReviewFile(change, options) {
  const comparison = toComparison(change);
  const path = change.newPath ?? change.oldPath ?? comparison.displayPath;
  const meta = classifyFilePath(path);
  return {
    id: options.id,
    path,
    worktreeStatus: options.worktreeStatus,
    hasWorkingTreeFile: options.hasWorkingTreeFile,
    inGitDiff: true,
    gitDiff: comparison,
    kind: meta.kind,
    mimeType: meta.mimeType
  };
}
async function loadBinarySideFromWorkingTree(repoRoot, path, mimeType) {
  if (path == null) return { exists: false, previewUrl: null };
  const bytes = await getWorkingTreeBytes(repoRoot, path);
  if (bytes == null) return { exists: false, previewUrl: null };
  return { exists: true, previewUrl: mimeType ? bufferToDataUrl(bytes, mimeType) : null };
}
async function loadBinarySideFromRevision(pi, repoRoot, revision, path, mimeType) {
  if (path == null) return { exists: false, previewUrl: null };
  const bytes = await getRevisionBytes(pi, repoRoot, revision, path);
  if (bytes == null) return { exists: false, previewUrl: null };
  return { exists: true, previewUrl: mimeType ? bufferToDataUrl(bytes, mimeType) : null };
}
function mergeChangedPaths(...groups) {
  const merged = /* @__PURE__ */ new Map();
  for (const group of groups) {
    for (const change of group) {
      const key = change.newPath ?? change.oldPath ?? "";
      if (key.length === 0) continue;
      merged.set(key, change);
    }
  }
  return [...merged.values()];
}
function toUntrackedChangedPaths(paths) {
  return paths.map((path) => ({ status: "added", oldPath: null, newPath: path }));
}
function shouldNormalizeBranchChanges(trackedChanges, workingTreeStatus) {
  if (workingTreeStatus.hasRenames) return true;
  if (!workingTreeStatus.hasUntracked) return false;
  return trackedChanges.some((change) => change.status === "deleted");
}
async function getTrackedBranchReviewChanges(pi, repoRoot, branchComparisonBase) {
  return parseNameStatus(
    await runGitAllowFailure(pi, repoRoot, [
      "diff",
      "--find-renames",
      "-M",
      "--name-status",
      branchComparisonBase,
      "--"
    ])
  );
}
async function getWorkingTreeSnapshotChanges(pi, repoRoot, baseRevision) {
  const scriptLines = [
    "set -euo pipefail",
    'tmp_index=$(mktemp "/tmp/pi-diff-review-index.XXXXXX")',
    `trap 'rm -f "$tmp_index"' EXIT`,
    'export GIT_INDEX_FILE="$tmp_index"'
  ];
  if (baseRevision != null) {
    scriptLines.push(`git read-tree ${shellQuote(baseRevision)}`);
  } else {
    scriptLines.push('rm -f "$tmp_index"');
  }
  scriptLines.push("git add -A -- .");
  scriptLines.push(
    baseRevision != null ? `git diff --cached --find-renames -M --name-status ${shellQuote(baseRevision)} --` : "git diff --cached --find-renames -M --name-status --root --"
  );
  const output = await runBashAllowFailure(pi, repoRoot, scriptLines.join("\n"));
  return parseNameStatus(output);
}
async function getBranchReviewChanges(pi, repoRoot, branchComparisonBase, workingTreeStatus) {
  if (!branchComparisonBase) return [];
  const trackedChanges = await getTrackedBranchReviewChanges(pi, repoRoot, branchComparisonBase);
  if (shouldNormalizeBranchChanges(trackedChanges, workingTreeStatus)) {
    return getWorkingTreeSnapshotChanges(pi, repoRoot, branchComparisonBase);
  }
  return mergeChangedPaths(trackedChanges, toUntrackedChangedPaths(workingTreeStatus.untrackedPaths));
}
async function getWorkingTreeReviewChanges(pi, repoRoot, repositoryHasHead) {
  return getWorkingTreeSnapshotChanges(pi, repoRoot, repositoryHasHead ? "HEAD" : null);
}
function compareReviewFiles(a, b) {
  return a.path.localeCompare(b.path);
}
function toBranchReviewFile(change) {
  const comparison = toComparison(change);
  const path = change.newPath ?? change.oldPath ?? comparison.displayPath;
  return toReviewFile(change, {
    id: buildBranchFileId(path, change.newPath != null, comparison),
    worktreeStatus: change.status,
    hasWorkingTreeFile: change.newPath != null
  });
}
async function getReviewWindowData(pi, cwd) {
  const repoRoot = await getRepoRoot(pi, cwd);
  const repositoryHasHead = await hasHead(pi, repoRoot);
  const reviewBase = repositoryHasHead ? await findReviewBase(pi, repoRoot) : null;
  const branchComparisonBase = reviewBase?.mergeBase ?? (repositoryHasHead ? "HEAD" : null);
  const workingTreeStatus = await getWorkingTreeStatusInfo(pi, repoRoot);
  const branchChanges = repositoryHasHead ? await getBranchReviewChanges(pi, repoRoot, branchComparisonBase, workingTreeStatus) : await getWorkingTreeReviewChanges(pi, repoRoot, false);
  const files = branchChanges.filter((change) => isIncludedReviewPath(change.newPath ?? change.oldPath ?? "")).map(toBranchReviewFile).sort(compareReviewFiles);
  const commits = reviewBase ? await listRangeCommits(pi, repoRoot, `${reviewBase.mergeBase}..HEAD`, 100) : [];
  const workingTreeCommit = workingTreeStatus.hasReviewableChanges ? [createWorkingTreeCommitInfo()] : [];
  const fallbackCommits = repositoryHasHead && files.length === 0 && commits.length === 0 && !workingTreeStatus.hasReviewableChanges ? await listRangeCommits(pi, repoRoot, "HEAD", 20) : commits;
  return {
    repoRoot,
    files,
    commits: [...workingTreeCommit, ...fallbackCommits],
    branchBaseRef: reviewBase?.baseRef ?? null,
    branchMergeBaseSha: branchComparisonBase,
    repositoryHasHead
  };
}
async function listRangeCommits(pi, repoRoot, range, limit) {
  const sep = "";
  const format = ["%H", "%h", "%s", "%an", "%aI"].join(sep);
  const output = await runGitAllowFailure(pi, repoRoot, ["log", `-${limit}`, `--format=${format}`, range]);
  return output.split(/\r?\n/).map((line) => line.trimEnd()).filter((line) => line.length > 0).map((line) => {
    const [sha, shortSha, subject, authorName, authorDate] = line.split(sep);
    return {
      sha: sha ?? "",
      shortSha: shortSha ?? (sha ?? "").slice(0, 7),
      subject: subject ?? "",
      authorName: authorName ?? "",
      authorDate: authorDate ?? "",
      kind: "commit"
    };
  }).filter((commit) => commit.sha.length > 0);
}
async function getCommitFiles(pi, repoRoot, sha) {
  if (isWorkingTreeCommitSha(sha)) {
    const repositoryHasHead = await hasHead(pi, repoRoot);
    const changes2 = (await getWorkingTreeReviewChanges(pi, repoRoot, repositoryHasHead)).filter(
      (change) => isIncludedReviewPath(change.newPath ?? change.oldPath ?? "")
    );
    return changes2.map((change) => {
      const comparison = toComparison(change);
      return toReviewFile(change, {
        id: buildCommitFileId(sha, comparison),
        worktreeStatus: change.status,
        hasWorkingTreeFile: change.newPath != null
      });
    }).sort(compareReviewFiles);
  }
  const output = await runGitAllowFailure(pi, repoRoot, [
    "diff-tree",
    "--root",
    "--find-renames",
    "-M",
    "--name-status",
    "--no-commit-id",
    "-r",
    sha
  ]);
  const changes = parseNameStatus(output).filter(
    (change) => isIncludedReviewPath(change.newPath ?? change.oldPath ?? "")
  );
  return changes.map((change) => {
    const comparison = toComparison(change);
    return toReviewFile(change, {
      id: buildCommitFileId(sha, comparison),
      worktreeStatus: null,
      hasWorkingTreeFile: false
    });
  }).sort(compareReviewFiles);
}
async function loadReviewFileContents(pi, repoRoot, file, scope, commitSha = null, branchMergeBaseSha = null) {
  const emptyBinaryContents = {
    originalContent: "",
    modifiedContent: "",
    kind: file.kind,
    mimeType: file.mimeType,
    originalExists: false,
    modifiedExists: false,
    originalPreviewUrl: null,
    modifiedPreviewUrl: null
  };
  if (file.kind !== "text") {
    if (scope === "all") {
      const path = file.gitDiff?.newPath ?? (file.hasWorkingTreeFile ? file.path : null);
      const modifiedSide2 = file.hasWorkingTreeFile ? await loadBinarySideFromWorkingTree(repoRoot, path, file.mimeType) : await loadBinarySideFromRevision(pi, repoRoot, "HEAD", path, file.mimeType);
      return {
        ...emptyBinaryContents,
        modifiedExists: modifiedSide2.exists,
        modifiedPreviewUrl: modifiedSide2.previewUrl
      };
    }
    const comparison2 = file.gitDiff;
    if (comparison2 == null) return emptyBinaryContents;
    if (scope === "commits") {
      if (!commitSha) return emptyBinaryContents;
      if (isWorkingTreeCommitSha(commitSha)) {
        const repositoryHasHead = await hasHead(pi, repoRoot);
        const originalSide3 = repositoryHasHead ? await loadBinarySideFromRevision(pi, repoRoot, "HEAD", comparison2.oldPath, file.mimeType) : { exists: false, previewUrl: null };
        const modifiedSide3 = file.hasWorkingTreeFile ? await loadBinarySideFromWorkingTree(repoRoot, comparison2.newPath, file.mimeType) : { exists: false, previewUrl: null };
        return {
          ...emptyBinaryContents,
          originalExists: originalSide3.exists,
          modifiedExists: modifiedSide3.exists,
          originalPreviewUrl: originalSide3.previewUrl,
          modifiedPreviewUrl: modifiedSide3.previewUrl
        };
      }
      const originalSide2 = await loadBinarySideFromRevision(
        pi,
        repoRoot,
        `${commitSha}^`,
        comparison2.oldPath,
        file.mimeType
      );
      const modifiedSide2 = await loadBinarySideFromRevision(pi, repoRoot, commitSha, comparison2.newPath, file.mimeType);
      return {
        ...emptyBinaryContents,
        originalExists: originalSide2.exists,
        modifiedExists: modifiedSide2.exists,
        originalPreviewUrl: originalSide2.previewUrl,
        modifiedPreviewUrl: modifiedSide2.previewUrl
      };
    }
    if (!branchMergeBaseSha) return emptyBinaryContents;
    const originalSide = await loadBinarySideFromRevision(
      pi,
      repoRoot,
      branchMergeBaseSha,
      comparison2.oldPath,
      file.mimeType
    );
    const modifiedSide = file.hasWorkingTreeFile ? await loadBinarySideFromWorkingTree(repoRoot, comparison2.newPath, file.mimeType) : await loadBinarySideFromRevision(pi, repoRoot, "HEAD", comparison2.newPath, file.mimeType);
    return {
      ...emptyBinaryContents,
      originalExists: originalSide.exists,
      modifiedExists: modifiedSide.exists,
      originalPreviewUrl: originalSide.previewUrl,
      modifiedPreviewUrl: modifiedSide.previewUrl
    };
  }
  if (scope === "all") {
    const path = file.gitDiff?.newPath ?? (file.hasWorkingTreeFile ? file.path : null);
    const content = path == null ? "" : file.hasWorkingTreeFile ? await getWorkingTreeContent(repoRoot, path) : await getRevisionContent(pi, repoRoot, "HEAD", path);
    return {
      originalContent: content,
      modifiedContent: content,
      kind: file.kind,
      mimeType: file.mimeType,
      originalExists: path != null,
      modifiedExists: path != null,
      originalPreviewUrl: null,
      modifiedPreviewUrl: null
    };
  }
  const comparison = file.gitDiff;
  if (comparison == null) {
    return {
      originalContent: "",
      modifiedContent: "",
      kind: file.kind,
      mimeType: file.mimeType,
      originalExists: false,
      modifiedExists: false,
      originalPreviewUrl: null,
      modifiedPreviewUrl: null
    };
  }
  if (scope === "commits") {
    if (!commitSha) {
      return {
        originalContent: "",
        modifiedContent: "",
        kind: file.kind,
        mimeType: file.mimeType,
        originalExists: false,
        modifiedExists: false,
        originalPreviewUrl: null,
        modifiedPreviewUrl: null
      };
    }
    if (isWorkingTreeCommitSha(commitSha)) {
      const repositoryHasHead = await hasHead(pi, repoRoot);
      const originalContent3 = repositoryHasHead && comparison.oldPath != null ? await getRevisionContent(pi, repoRoot, "HEAD", comparison.oldPath) : "";
      const modifiedContent3 = comparison.newPath == null ? "" : file.hasWorkingTreeFile ? await getWorkingTreeContent(repoRoot, comparison.newPath) : "";
      return {
        originalContent: originalContent3,
        modifiedContent: modifiedContent3,
        kind: file.kind,
        mimeType: file.mimeType,
        originalExists: repositoryHasHead && comparison.oldPath != null,
        modifiedExists: comparison.newPath != null,
        originalPreviewUrl: null,
        modifiedPreviewUrl: null
      };
    }
    const originalContent2 = comparison.oldPath == null ? "" : await getRevisionContent(pi, repoRoot, `${commitSha}^`, comparison.oldPath);
    const modifiedContent2 = comparison.newPath == null ? "" : await getRevisionContent(pi, repoRoot, commitSha, comparison.newPath);
    return {
      originalContent: originalContent2,
      modifiedContent: modifiedContent2,
      kind: file.kind,
      mimeType: file.mimeType,
      originalExists: comparison.oldPath != null,
      modifiedExists: comparison.newPath != null,
      originalPreviewUrl: null,
      modifiedPreviewUrl: null
    };
  }
  if (!branchMergeBaseSha) {
    return {
      originalContent: "",
      modifiedContent: "",
      kind: file.kind,
      mimeType: file.mimeType,
      originalExists: false,
      modifiedExists: false,
      originalPreviewUrl: null,
      modifiedPreviewUrl: null
    };
  }
  const originalContent = comparison.oldPath == null ? "" : await getRevisionContent(pi, repoRoot, branchMergeBaseSha, comparison.oldPath);
  const modifiedContent = comparison.newPath == null ? "" : file.hasWorkingTreeFile ? await getWorkingTreeContent(repoRoot, comparison.newPath) : await getRevisionContent(pi, repoRoot, "HEAD", comparison.newPath);
  return {
    originalContent,
    modifiedContent,
    kind: file.kind,
    mimeType: file.mimeType,
    originalExists: comparison.oldPath != null,
    modifiedExists: comparison.newPath != null,
    originalPreviewUrl: null,
    modifiedPreviewUrl: null
  };
}

// node_modules/@ryan_nookpi/pi-extension-diff-review/prompt.ts
function formatScopeLabel(comment) {
  switch (comment.scope) {
    case "branch":
      return "branch diff";
    case "commits":
      return comment.commitKind === "working-tree" ? "working tree changes" : comment.commitShort ? `commit ${comment.commitShort}` : "commit";
    default:
      return "all files";
  }
}
function getCommentFilePath(file) {
  if (file == null) return "(unknown file)";
  return file.gitDiff?.displayPath ?? file.path;
}
function formatLocation(comment, file) {
  const filePath = getCommentFilePath(file);
  const scopePrefix = `[${formatScopeLabel(comment)}] `;
  if (comment.side === "file" || comment.startLine == null) {
    return `${scopePrefix}${filePath}`;
  }
  const range = comment.endLine != null && comment.endLine !== comment.startLine ? `${comment.startLine}-${comment.endLine}` : `${comment.startLine}`;
  if (comment.scope === "all") {
    return `${scopePrefix}${filePath}:${range}`;
  }
  const suffix = comment.side === "original" ? " (old)" : " (new)";
  return `${scopePrefix}${filePath}:${range}${suffix}`;
}
function composeReviewPrompt(files, payload) {
  const fileMap = new Map(files.map((file) => [file.id, file]));
  const lines = [];
  lines.push("Please address the following feedback");
  lines.push("");
  const overallComment = payload.overallComment.trim();
  if (overallComment.length > 0) {
    lines.push(overallComment);
    lines.push("");
  }
  payload.comments.forEach((comment, index) => {
    const file = fileMap.get(comment.fileId);
    lines.push(`${index + 1}. ${formatLocation(comment, file)}`);
    lines.push(`   ${comment.body.trim()}`);
    lines.push("");
  });
  return lines.join("\n").trim();
}

// node_modules/@ryan_nookpi/pi-extension-diff-review/quiet-glimpse.ts
import { spawn as spawn2 } from "node:child_process";
import { EventEmitter as EventEmitter2 } from "node:events";
import { existsSync as existsSync3 } from "node:fs";
import { createInterface as createInterface2 } from "node:readline";
var QuietGlimpseWindowImpl = class extends EventEmitter2 {
  #proc;
  #closed = false;
  #pendingHTML;
  #stderr = "";
  constructor(proc, initialHTML) {
    super();
    this.#proc = proc;
    this.#pendingHTML = initialHTML;
    proc.stdin.on("error", () => {
    });
    proc.stderr.on("data", (chunk) => {
      this.#stderr += chunk.toString();
    });
    const rl = createInterface2({ input: proc.stdout, crlfDelay: Infinity });
    rl.on("line", (line) => {
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        this.emit("error", new Error(`Malformed glimpse protocol line: ${line}`));
        return;
      }
      switch (message.type) {
        case "ready":
          if (this.#pendingHTML != null) {
            this.setHTML(this.#pendingHTML);
            this.#pendingHTML = null;
          }
          break;
        case "message":
          this.emit("message", message.data);
          break;
        case "closed":
          this.#markClosed();
          break;
        default:
          break;
      }
    });
    proc.on("error", (error) => this.emit("error", error));
    proc.on("exit", (code) => {
      const stderr = this.#stderr.trim();
      if (!this.#closed && code && stderr) {
        this.emit("error", new Error(stderr));
      }
      this.#markClosed();
    });
  }
  send(js) {
    this.#write({ type: "eval", js });
  }
  close() {
    this.#write({ type: "close" });
  }
  #markClosed() {
    if (this.#closed) return;
    this.#closed = true;
    this.emit("closed");
  }
  #write(obj) {
    if (this.#closed) return;
    this.#proc.stdin.write(`${JSON.stringify(obj)}
`);
  }
  setHTML(html) {
    this.#write({ type: "html", html: Buffer.from(html).toString("base64") });
  }
};
async function getNativeHostInfo2() {
  const glimpseModule = await Promise.resolve().then(() => (init_glimpse(), glimpse_exports));
  return glimpseModule.getNativeHostInfo();
}
async function openQuietGlimpse(html, options = {}) {
  const host = await getNativeHostInfo2();
  if (!existsSync3(host.path)) {
    const hint = host.buildHint ? ` ${host.buildHint}` : "";
    throw new Error(`Glimpse host not found at '${host.path}'.${hint}`);
  }
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
  if (options.x != null) args.push(`--x=${options.x}`);
  if (options.y != null) args.push(`--y=${options.y}`);
  if (options.cursorOffset?.x != null) args.push(`--cursor-offset-x=${options.cursorOffset.x}`);
  if (options.cursorOffset?.y != null) args.push(`--cursor-offset-y=${options.cursorOffset.y}`);
  if (options.cursorAnchor != null) args.push("--cursor-anchor", options.cursorAnchor);
  if (options.followMode != null) args.push("--follow-mode", options.followMode);
  if (options.followCursor) args.push("--follow-cursor");
  const proc = spawn2(host.path, [...host.extraArgs ?? [], ...args], {
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: process.platform === "win32",
    env: {
      ...process.env,
      OS_ACTIVITY_MODE: process.env.OS_ACTIVITY_MODE ?? "disable"
    }
  });
  return new QuietGlimpseWindowImpl(proc, html);
}

// node_modules/@ryan_nookpi/pi-extension-diff-review/ui.ts
import { readFileSync as readFileSync2 } from "node:fs";
import { dirname as dirname3, join as join4 } from "node:path";
import { fileURLToPath as fileURLToPath3 } from "node:url";
var __dirname3 = dirname3(fileURLToPath3(import.meta.url));
var webDir = join4(__dirname3, "web");
function escapeForInlineScript(value) {
  return value.replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}
function buildReviewHtml(data) {
  const templateHtml = readFileSync2(join4(webDir, "index.html"), "utf8");
  const appJs = readFileSync2(join4(webDir, "app.js"), "utf8");
  const payload = escapeForInlineScript(JSON.stringify(data));
  return templateHtml.replace('"__INLINE_DATA__"', payload).replace("__INLINE_JS__", appJs);
}

// node_modules/@ryan_nookpi/pi-extension-diff-review/index.ts
function isSubmitPayload(value) {
  return value.type === "submit";
}
function isCancelPayload(value) {
  return value.type === "cancel";
}
function isRequestFilePayload(value) {
  return value.type === "request-file";
}
function isRequestCommitPayload(value) {
  return value.type === "request-commit";
}
function isRequestReviewDataPayload(value) {
  return value.type === "request-review-data";
}
function escapeForInlineScript2(value) {
  return value.replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}
function hasReviewFeedback(payload) {
  return payload.overallComment.trim().length > 0 || payload.comments.some((comment) => comment.body.trim().length > 0);
}
function appendReviewPrompt(ctx, prompt2) {
  const prefix = ctx.ui.getEditorText().trim().length > 0 ? "\n\n" : "";
  ctx.ui.pasteToEditor(`${prefix}${prompt2}`);
}
function pi_extension_diff_review_default(pi) {
  let activeWindow = null;
  const suppressedWindows = /* @__PURE__ */ new WeakSet();
  function closeActiveWindow(options = {}) {
    if (activeWindow == null) return;
    const windowToClose = activeWindow;
    activeWindow = null;
    if (options.suppressResults) {
      suppressedWindows.add(windowToClose);
    }
    try {
      windowToClose.close();
    } catch {
    }
  }
  async function reviewRepository(ctx) {
    if (activeWindow != null) {
      ctx.ui.notify("A review window is already open.", "warning");
      return;
    }
    try {
      let reviewData = await getReviewWindowData(pi, ctx.cwd);
      const { repoRoot } = reviewData;
      if (reviewData.files.length === 0 && reviewData.commits.length === 0) {
        ctx.ui.notify("No reviewable files found.", "info");
        return;
      }
      const html = buildReviewHtml(reviewData);
      const window = await openQuietGlimpse(html, {
        width: 1680,
        height: 1020,
        title: "pi review"
      });
      activeWindow = window;
      const fileMap = new Map(reviewData.files.map((file) => [file.id, file]));
      const commitFileCache = /* @__PURE__ */ new Map();
      const contentCache = /* @__PURE__ */ new Map();
      const clearRefreshableCaches = () => {
        contentCache.clear();
        for (const sha of commitFileCache.keys()) {
          if (isWorkingTreeCommitSha(sha)) {
            commitFileCache.delete(sha);
          }
        }
      };
      const sendWindowMessage = (message) => {
        if (activeWindow !== window) return;
        const payload = escapeForInlineScript2(JSON.stringify(message));
        window.send(`window.__reviewReceive(${payload});`);
      };
      const loadCommitFiles = (sha) => {
        const cached2 = commitFileCache.get(sha);
        if (cached2 != null) return cached2;
        const pending = getCommitFiles(pi, repoRoot, sha);
        commitFileCache.set(sha, pending);
        pending.then((commitFiles) => {
          for (const cf of commitFiles) fileMap.set(cf.id, cf);
        }).catch(() => {
        });
        return pending;
      };
      const loadContents = (file, scope, commitSha) => {
        const cacheKey = `${scope}:${commitSha ?? ""}:${file.id}`;
        const cached2 = contentCache.get(cacheKey);
        if (cached2 != null) return cached2;
        const pending = loadReviewFileContents(pi, repoRoot, file, scope, commitSha, reviewData.branchMergeBaseSha);
        contentCache.set(cacheKey, pending);
        return pending;
      };
      const terminalMessagePromise = new Promise(
        (resolve2, reject) => {
          let settled = false;
          let closeTimer = null;
          const cleanup = () => {
            if (closeTimer != null) {
              clearTimeout(closeTimer);
              closeTimer = null;
            }
            window.removeListener("message", onMessage);
            window.removeListener("closed", onClosed);
            window.removeListener("error", onError);
            if (activeWindow === window) {
              activeWindow = null;
            }
          };
          const settle = (value) => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve2(value);
          };
          const handleRequestFile = async (message) => {
            const file = fileMap.get(message.fileId);
            if (file == null) {
              sendWindowMessage({
                type: "file-error",
                requestId: message.requestId,
                fileId: message.fileId,
                scope: message.scope,
                commitSha: message.commitSha ?? null,
                message: "Unknown file requested."
              });
              return;
            }
            try {
              const contents = await loadContents(file, message.scope, message.commitSha ?? null);
              sendWindowMessage({
                type: "file-data",
                requestId: message.requestId,
                fileId: message.fileId,
                scope: message.scope,
                commitSha: message.commitSha ?? null,
                originalContent: contents.originalContent,
                modifiedContent: contents.modifiedContent,
                kind: contents.kind,
                mimeType: contents.mimeType,
                originalExists: contents.originalExists,
                modifiedExists: contents.modifiedExists,
                originalPreviewUrl: contents.originalPreviewUrl,
                modifiedPreviewUrl: contents.modifiedPreviewUrl
              });
            } catch (error) {
              const messageText = error instanceof Error ? error.message : String(error);
              sendWindowMessage({
                type: "file-error",
                requestId: message.requestId,
                fileId: message.fileId,
                scope: message.scope,
                commitSha: message.commitSha ?? null,
                message: messageText
              });
            }
          };
          const handleRequestCommit = async (message) => {
            try {
              const commitFiles = await loadCommitFiles(message.sha);
              sendWindowMessage({
                type: "commit-data",
                requestId: message.requestId,
                sha: message.sha,
                files: commitFiles
              });
            } catch (error) {
              const messageText = error instanceof Error ? error.message : String(error);
              sendWindowMessage({
                type: "commit-error",
                requestId: message.requestId,
                sha: message.sha,
                message: messageText
              });
            }
          };
          const handleRequestReviewData = async (message) => {
            clearRefreshableCaches();
            reviewData = await getReviewWindowData(pi, repoRoot);
            for (const file of reviewData.files) fileMap.set(file.id, file);
            sendWindowMessage({
              type: "review-data",
              requestId: message.requestId,
              files: reviewData.files,
              commits: reviewData.commits,
              branchBaseRef: reviewData.branchBaseRef,
              branchMergeBaseSha: reviewData.branchMergeBaseSha,
              repositoryHasHead: reviewData.repositoryHasHead
            });
          };
          const onMessage = (data) => {
            const message = data;
            if (isRequestFilePayload(message)) {
              void handleRequestFile(message);
              return;
            }
            if (isRequestCommitPayload(message)) {
              void handleRequestCommit(message);
              return;
            }
            if (isRequestReviewDataPayload(message)) {
              void handleRequestReviewData(message);
              return;
            }
            if (isSubmitPayload(message) || isCancelPayload(message)) {
              settle(message);
            }
          };
          const onClosed = () => {
            if (settled || closeTimer != null) return;
            closeTimer = setTimeout(() => {
              closeTimer = null;
              settle(null);
            }, 250);
          };
          const onError = (error) => {
            if (settled) return;
            settled = true;
            cleanup();
            reject(error);
          };
          window.on("message", onMessage);
          window.on("closed", onClosed);
          window.on("error", onError);
        }
      );
      void (async () => {
        try {
          const message = await terminalMessagePromise;
          if (suppressedWindows.has(window)) return;
          if (message == null) return;
          if (message.type === "cancel") {
            ctx.ui.notify("Review cancelled.", "info");
            return;
          }
          if (!hasReviewFeedback(message)) return;
          const prompt2 = composeReviewPrompt([...fileMap.values()], message);
          appendReviewPrompt(ctx, prompt2);
          ctx.ui.notify("Appended review feedback to the editor.", "info");
        } catch (error) {
          if (suppressedWindows.has(window)) return;
          const message = error instanceof Error ? error.message : String(error);
          ctx.ui.notify(`Review failed: ${message}`, "error");
        }
      })();
      ctx.ui.notify("Opened native review window.", "info");
    } catch (error) {
      closeActiveWindow({ suppressResults: true });
      const message = error instanceof Error ? error.message : String(error);
      ctx.ui.notify(`Review failed: ${message}`, "error");
    }
  }
  pi.registerCommand("diff-review", {
    description: "Open a native review window with branch, per-commit, and all-files scopes",
    handler: async (_args, ctx) => {
      await reviewRepository(ctx);
    }
  });
  pi.on("session_shutdown", async () => {
    closeActiveWindow({ suppressResults: true });
  });
}
export {
  pi_extension_diff_review_default as default
};
