// src/parser.ts
var PULL_URL_RE = /https:\/\/github\.com\/([^/\s)]+)\/([^/\s)]+)\/pull\/(\d+)/i;
var PULL_REQUEST_NUMBER_RE = /(?:pull request|pr)\s*#(\d+)/i;
function extractTextContent(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((block) => {
    if (!block || typeof block !== "object") return "";
    const value = block;
    return value.type === "text" && typeof value.text === "string" ? value.text : "";
  }).filter(Boolean).join("\n");
}
function extractPullRequestRef(text) {
  const urlMatch = text.match(PULL_URL_RE);
  if (urlMatch) {
    const [, owner, repo, numberText] = urlMatch;
    const url = `https://github.com/${owner}/${repo}/pull/${numberText}`;
    return { ref: url, url, owner, repo, number: Number(numberText) };
  }
  const numberMatch = text.match(PULL_REQUEST_NUMBER_RE);
  if (numberMatch) {
    const number = Number(numberMatch[1]);
    return { ref: String(number), number };
  }
  return void 0;
}
function isPullRequestCreationCommand(command) {
  return /(?:^|[\s;&|()])gh\s+pr\s+create(?:\s|$)/.test(command);
}
function splitArgs(input) {
  const args = [];
  let current = "";
  let quote;
  let escaping = false;
  for (const char of input) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }
    if (char === "\\" && quote !== "'") {
      escaping = true;
      continue;
    }
    if ((char === '"' || char === "'") && quote === void 0) {
      quote = char;
      continue;
    }
    if (quote === char) {
      quote = void 0;
      continue;
    }
    if (/\s/.test(char) && quote === void 0) {
      if (current) {
        args.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }
  if (escaping) current += "\\";
  if (current) args.push(current);
  return args;
}

// src/commands.ts
var SUBCOMMANDS = /* @__PURE__ */ new Set(["show", "refresh", "track", "open", "merge", "untrack", "help"]);
var MERGE_METHOD_FLAGS = /* @__PURE__ */ new Set(["--merge", "-m", "--squash", "-s", "--rebase", "-r", "--auto", "--disable-auto"]);
function parsePrCommand(input) {
  const args = splitArgs(input.trim());
  if (args.length === 0) return { command: "show", args: [] };
  const first = args[0]?.toLowerCase();
  if (first && SUBCOMMANDS.has(first)) {
    return { command: first, args: args.slice(1) };
  }
  return { command: "track", args };
}
function hasMergeMethod(args) {
  return args.some((arg) => MERGE_METHOD_FLAGS.has(arg));
}
function mergeHelpText() {
  return "Use /pr merge --merge, /pr merge --squash, /pr merge --rebase, or /pr merge --auto. In interactive mode, /pr merge opens a method picker.";
}
function helpText() {
  return [
    "PR tracker commands:",
    "/pr                 show tracked PR, or track current branch PR if none is tracked",
    "/pr refresh         refresh tracked PR status from GitHub",
    "/pr track <ref>     track PR number, URL, or branch (omitting ref uses current branch)",
    "/pr open            open tracked PR in the browser",
    "/pr merge [flags]   confirm and run gh pr merge for the tracked PR",
    "/pr untrack         remove PR tracking from this pi session"
  ].join("\n");
}

// src/types.ts
var EXTENSION_ID = "pr-tracker";
var PR_VIEW_FIELDS = [
  "additions",
  "baseRefName",
  "changedFiles",
  "deletions",
  "headRefName",
  "isDraft",
  "mergeStateStatus",
  "mergeable",
  "number",
  "reviewDecision",
  "state",
  "statusCheckRollup",
  "title",
  "url"
];

// src/github.ts
var GH_TIMEOUT_MS = 15e3;
var GH_MERGE_TIMEOUT_MS = 12e4;
function asString(value) {
  return typeof value === "string" && value.length > 0 ? value : void 0;
}
function asNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : void 0;
}
function asBoolean(value) {
  return typeof value === "boolean" ? value : void 0;
}
function field(record, key) {
  return record && typeof record === "object" ? record[key] : void 0;
}
function normalizeCheckItem(item) {
  const conclusion = asString(field(item, "conclusion"))?.toUpperCase();
  const status = asString(field(item, "status"))?.toUpperCase();
  const state = asString(field(item, "state"))?.toUpperCase();
  if (["FAILURE", "FAILED", "ERROR", "TIMED_OUT", "CANCELLED", "ACTION_REQUIRED", "STARTUP_FAILURE"].includes(conclusion ?? "")) {
    return "failed";
  }
  if (["SUCCESS", "SKIPPED", "NEUTRAL"].includes(conclusion ?? "")) return "passed";
  if (["FAILURE", "FAILED", "ERROR"].includes(state ?? "")) return "failed";
  if (state === "SUCCESS") return "passed";
  if (status && status !== "COMPLETED") return "pending";
  if (status === "COMPLETED" && !conclusion) return "unknown";
  if (state && !["SUCCESS", "FAILURE", "FAILED", "ERROR"].includes(state)) return "pending";
  return "unknown";
}
function summarizeChecks(rollup) {
  if (!Array.isArray(rollup) || rollup.length === 0) {
    return { state: "none", total: 0, passed: 0, pending: 0, failed: 0 };
  }
  let passed = 0;
  let pending = 0;
  let failed = 0;
  let unknown = 0;
  for (const item of rollup) {
    switch (normalizeCheckItem(item)) {
      case "passed":
        passed += 1;
        break;
      case "pending":
        pending += 1;
        break;
      case "failed":
        failed += 1;
        break;
      case "unknown":
        unknown += 1;
        break;
    }
  }
  const state = failed > 0 ? "failing" : pending > 0 ? "pending" : unknown > 0 ? "unknown" : "passing";
  return { state, total: rollup.length, passed, pending, failed };
}
function summarizeReview(decision) {
  const normalized = asString(decision)?.toUpperCase();
  switch (normalized) {
    case "APPROVED":
      return { state: "approved", label: "Review approved", decision: normalized };
    case "CHANGES_REQUESTED":
      return { state: "changes_requested", label: "Changes requested", decision: normalized };
    case "REVIEW_REQUIRED":
      return { state: "required", label: "Review required", decision: normalized };
    case void 0:
    case "":
      return { state: "none", label: "No review rule" };
    default:
      return { state: "unknown", label: `Review ${normalized.toLowerCase()}`, decision: normalized };
  }
}
function determineReadiness(raw, checks, review) {
  const state = asString(field(raw, "state"))?.toUpperCase();
  const mergeable = asString(field(raw, "mergeable"))?.toUpperCase();
  const mergeStateStatus = asString(field(raw, "mergeStateStatus"))?.toUpperCase();
  const isDraft = asBoolean(field(raw, "isDraft"));
  if (state === "MERGED") return { state: "merged", label: "Merged" };
  if (state === "CLOSED") return { state: "closed", label: "Closed" };
  if (isDraft) return { state: "draft", label: "Draft" };
  if (mergeable === "CONFLICTING" || mergeStateStatus === "DIRTY") return { state: "conflicts", label: "Conflicts" };
  if (checks.state === "failing") return { state: "checks_failing", label: "Checks failing" };
  if (checks.state === "pending") return { state: "checks_pending", label: "Checks pending" };
  if (review.state === "changes_requested") return { state: "changes_requested", label: "Changes requested" };
  if (review.state === "required") return { state: "review_required", label: "Review required" };
  if (mergeStateStatus === "BEHIND") return { state: "behind", label: "Behind base" };
  if (["BLOCKED", "UNSTABLE", "HAS_HOOKS"].includes(mergeStateStatus ?? "")) return { state: "blocked", label: "Blocked" };
  if (checks.state === "unknown" || mergeable === "UNKNOWN" || mergeStateStatus === "UNKNOWN") return { state: "unknown", label: "Open" };
  return { state: "ready", label: "Ready to merge" };
}
function normalizePullRequestStatus(raw, now = () => (/* @__PURE__ */ new Date()).toISOString()) {
  const number = asNumber(field(raw, "number"));
  if (number === void 0) throw new Error("GitHub response did not include a PR number");
  const checks = summarizeChecks(field(raw, "statusCheckRollup"));
  const review = summarizeReview(field(raw, "reviewDecision"));
  return {
    number,
    url: asString(field(raw, "url")),
    title: asString(field(raw, "title")),
    state: asString(field(raw, "state")),
    isDraft: asBoolean(field(raw, "isDraft")),
    mergeable: asString(field(raw, "mergeable")),
    mergeStateStatus: asString(field(raw, "mergeStateStatus")),
    reviewDecision: asString(field(raw, "reviewDecision")),
    changedFiles: asNumber(field(raw, "changedFiles")),
    additions: asNumber(field(raw, "additions")),
    deletions: asNumber(field(raw, "deletions")),
    headRefName: asString(field(raw, "headRefName")),
    baseRefName: asString(field(raw, "baseRefName")),
    checks,
    review,
    readiness: determineReadiness(raw, checks, review),
    updatedAt: now()
  };
}
function assertSuccess(result, action) {
  if (result.code === void 0 || result.code === 0) return;
  const message = result.stderr || result.stdout || `${action} failed with exit code ${result.code}`;
  throw new Error(message.trim());
}
async function fetchPullRequestStatus(exec, cwd, ref, signal) {
  const args = ["pr", "view"];
  if (ref) args.push(ref);
  args.push("--json", PR_VIEW_FIELDS.join(","));
  const result = await exec("gh", args, { cwd, signal, timeout: GH_TIMEOUT_MS });
  assertSuccess(result, "gh pr view");
  try {
    return normalizePullRequestStatus(JSON.parse(result.stdout ?? ""));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`Could not parse gh pr view JSON: ${error.message}`);
    throw error;
  }
}
async function openPullRequest(exec, cwd, ref, signal) {
  const result = await exec("gh", ["pr", "view", ref, "--web"], { cwd, signal, timeout: GH_TIMEOUT_MS });
  assertSuccess(result, "gh pr view --web");
}
async function mergePullRequest(exec, cwd, ref, mergeArgs, signal) {
  const result = await exec("gh", ["pr", "merge", ref, ...mergeArgs], { cwd, signal, timeout: GH_MERGE_TIMEOUT_MS });
  assertSuccess(result, "gh pr merge");
}

// src/state.ts
function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}
function createEmptyState() {
  return {};
}
function serializeState(state) {
  return { version: 1, kind: "state", state: cloneState(state) };
}
function isTrackerEntryData(value) {
  if (!value || typeof value !== "object") return false;
  const record = value;
  return record.version === 1 && record.kind === "state" && typeof record.state === "object" && record.state !== null;
}
function reconstructState(entries) {
  let state = createEmptyState();
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry;
    if (record.type !== "custom" || record.customType !== EXTENSION_ID) continue;
    if (isTrackerEntryData(record.data)) state = cloneState(record.data.state);
  }
  return state;
}
function createTrackedState(status, previous, options) {
  const now = options?.now ?? (() => (/* @__PURE__ */ new Date()).toISOString());
  const trackedAt = previous.trackedAt ?? now();
  const trackedRef = status.url ?? options?.ref ?? previous.trackedRef ?? String(status.number);
  return {
    ...previous,
    pr: status,
    trackedRef,
    trackedAt,
    source: options?.source ?? previous.source,
    lastError: void 0,
    updatedAt: status.updatedAt
  };
}
function createErrorState(previous, message, now = () => (/* @__PURE__ */ new Date()).toISOString()) {
  return { ...previous, lastError: message, updatedAt: now() };
}

// src/ui.ts
function truncate(text, maxLength) {
  return text.length <= maxLength ? text : `${text.slice(0, Math.max(0, maxLength - 1))}\u2026`;
}
function formatChecks(checks) {
  if (checks.total === 0) return "Checks \u2014";
  if (checks.state === "passing") return `Checks \u2713 ${checks.passed}/${checks.total}`;
  if (checks.state === "failing") return `Checks \u2717 ${checks.failed}/${checks.total}`;
  if (checks.state === "pending") return `Checks \u2026 ${checks.pending}/${checks.total}`;
  return `Checks ? ${checks.passed}/${checks.total}`;
}
function formatPullRequestDetails(pr) {
  const segments = [formatChecks(pr.checks), pr.review.label];
  if (pr.changedFiles !== void 0) segments.push(`Changes ${pr.changedFiles}`);
  if (pr.additions !== void 0 || pr.deletions !== void 0) segments.push(`+${pr.additions ?? 0}/-${pr.deletions ?? 0}`);
  if (pr.headRefName && pr.baseRefName) segments.push(`${pr.headRefName} \u2192 ${pr.baseRefName}`);
  return segments.join(" \xB7 ");
}
function renderWidgetLines(state) {
  const pr = state.pr;
  if (!pr) return void 0;
  const title = pr.title ? ` \xB7 ${truncate(pr.title, 72)}` : "";
  const lines = [`#${pr.number} ${pr.readiness.label}${title}`, `  ${formatPullRequestDetails(pr)}`];
  if (state.lastError) lines.push(`  Last refresh failed: ${truncate(state.lastError, 100)}`);
  lines.push("  /pr refresh \xB7 /pr open \xB7 /pr merge \xB7 /pr untrack");
  return lines;
}
function formatStatus(state) {
  const pr = state.pr;
  if (!pr) return void 0;
  return `PR #${pr.number} ${pr.readiness.label}`;
}
function formatNotification(state) {
  const pr = state.pr;
  if (!pr) return state.lastError ? `No tracked PR (${state.lastError})` : "No tracked PR";
  return `#${pr.number} ${pr.readiness.label}
${formatPullRequestDetails(pr)}${pr.url ? `
${pr.url}` : ""}`;
}
function syncTrackerUi(ctx, state) {
  if (!ctx.hasUI) return;
  ctx.ui.setWidget(EXTENSION_ID, renderWidgetLines(state));
  ctx.ui.setStatus(EXTENSION_ID, formatStatus(state));
}

// src/index.ts
var MERGE_METHODS = ["--merge", "--squash", "--rebase", "--auto"];
function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}
function notify(ctx, message, level = "info") {
  if (ctx.hasUI) ctx.ui.notify(message, level);
}
function getTrackedRef(state) {
  return state.trackedRef ?? state.pr?.url ?? (state.pr ? String(state.pr.number) : void 0);
}
function index_default(pi) {
  let state = createEmptyState();
  const exec = (command, args, options) => pi.exec(command, args, options);
  function persist(nextState) {
    pi.appendEntry(EXTENSION_ID, serializeState(nextState));
  }
  function setState(nextState, ctx, shouldPersist = true) {
    state = nextState;
    if (shouldPersist) persist(state);
    if (ctx) syncTrackerUi(ctx, state);
  }
  async function refreshTracked(ctx, ref, source, options) {
    try {
      const status = await fetchPullRequestStatus(exec, ctx.cwd, ref, ctx.signal);
      setState(createTrackedState(status, state, { ref, source }), ctx);
      if (options?.notify) notify(ctx, `Tracking ${formatNotification(state)}`, "info");
      return true;
    } catch (error) {
      setState(createErrorState(state, messageOf(error)), ctx);
      if (options?.notify) notify(ctx, `PR refresh failed: ${state.lastError}`, "error");
      return false;
    }
  }
  async function handleToolResult(event, ctx) {
    if (event.toolName !== "bash" || event.isError) return;
    const command = typeof event.input === "object" && event.input ? String(event.input.command ?? "") : "";
    if (!isPullRequestCreationCommand(command)) return;
    const output = extractTextContent(event.content);
    const ref = extractPullRequestRef(output)?.ref;
    await refreshTracked(ctx, ref, "gh pr create", { notify: true });
  }
  async function handlePrCommand(args, ctx) {
    const parsed = parsePrCommand(args);
    switch (parsed.command) {
      case "help":
        notify(ctx, helpText(), "info");
        return;
      case "show":
        if (state.pr) {
          notify(ctx, formatNotification(state), "info");
          return;
        }
        await refreshTracked(ctx, void 0, "current branch", { notify: true });
        return;
      case "refresh": {
        const ref = parsed.args[0] ?? getTrackedRef(state);
        await refreshTracked(ctx, ref, state.source, { notify: true });
        return;
      }
      case "track": {
        const ref = parsed.args[0];
        await refreshTracked(ctx, ref, "manual", { notify: true });
        return;
      }
      case "open": {
        const ref = getTrackedRef(state);
        if (!ref) {
          notify(ctx, "No tracked PR. Use /pr track <number|url|branch> first.", "warning");
          return;
        }
        try {
          await openPullRequest(exec, ctx.cwd, ref, ctx.signal);
          notify(ctx, `Opened PR ${state.pr ? `#${state.pr.number}` : ref}.`, "info");
        } catch (error) {
          notify(ctx, `Could not open PR: ${messageOf(error)}`, "error");
        }
        return;
      }
      case "merge": {
        const ref = getTrackedRef(state);
        if (!ref || !state.pr) {
          notify(ctx, "No tracked PR. Use /pr track <number|url|branch> first.", "warning");
          return;
        }
        let mergeArgs = parsed.args;
        if (mergeArgs.length === 0) {
          if (!ctx.hasUI) {
            notify(ctx, mergeHelpText(), "warning");
            return;
          }
          const method = await ctx.ui.select("Merge method", MERGE_METHODS);
          if (!method) return;
          mergeArgs = [method];
        } else if (!hasMergeMethod(mergeArgs)) {
          notify(ctx, mergeHelpText(), "warning");
          return;
        }
        if (!ctx.hasUI) return;
        const ok = await ctx.ui.confirm(
          `Merge PR #${state.pr.number}?`,
          `${state.pr.readiness.label}

Command: gh pr merge ${ref} ${mergeArgs.join(" ")}`
        );
        if (!ok) return;
        try {
          await mergePullRequest(exec, ctx.cwd, ref, mergeArgs, ctx.signal);
          notify(ctx, `Merged PR #${state.pr.number}.`, "info");
          await refreshTracked(ctx, ref, state.source, { notify: false });
        } catch (error) {
          notify(ctx, `Merge failed: ${messageOf(error)}`, "error");
        }
        return;
      }
      case "untrack":
        setState(createEmptyState(), ctx);
        notify(ctx, "PR tracking cleared for this session.", "info");
        return;
    }
  }
  pi.on("session_start", async (_event, ctx) => {
    state = reconstructState(ctx.sessionManager.getBranch());
    syncTrackerUi(ctx, state);
    const ref = getTrackedRef(state);
    if (ref) void refreshTracked(ctx, ref, state.source, { notify: false });
  });
  pi.on("tool_result", handleToolResult);
  pi.registerCommand("pr", {
    description: "Track and manage the pull request associated with this pi session",
    getArgumentCompletions(prefix) {
      const commands = ["show", "refresh", "track", "open", "merge", "untrack", "help"];
      return commands.filter((command) => command.startsWith(prefix)).map((command) => ({ value: command, label: command }));
    },
    handler: handlePrCommand
  });
}
export {
  index_default as default
};
