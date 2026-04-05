import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, afterEach, before, describe, it } from "node:test";
import { createStore } from "../core/store.js";
import type { CommandRunState, GlobalRunEntry } from "../core/types.js";
import { makeMockExtensionCtx, makeMockPi, makeRun } from "./_mocks.js";

// Set HOME so modules that call os.homedir() at import time use the tmp dir.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "subagent-orchestrator-test-"));
const origHome = process.env.HOME;
const origUserProfile = process.env.USERPROFILE;
process.env.HOME = tmpDir;
process.env.USERPROFILE = tmpDir;

let orchestrator: typeof import("../execution/orchestrator.js");

before(async () => {
  orchestrator = await import("../execution/orchestrator.js");
});

afterEach(() => {
  // Remove persisted group-completions file between tests.
  try {
    const stateFile = path.join(tmpDir, ".pi", "agent", "state", "subagent-pending-groups.json");
    if (fs.existsSync(stateFile)) fs.unlinkSync(stateFile);
  } catch {
    // ignore
  }
});

after(() => {
  if (origHome !== undefined) process.env.HOME = origHome;
  else process.env.HOME = undefined;
  if (origUserProfile !== undefined) process.env.USERPROFILE = origUserProfile;
  else process.env.USERPROFILE = undefined;
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
});

// ━━━ getCurrentSessionFile ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("getCurrentSessionFile", () => {
  it("returns the session file from sessionManager", () => {
    const ctx = makeMockExtensionCtx({ sessionFile: "/tmp/session-a.jsonl" });
    assert.equal(orchestrator.getCurrentSessionFile(ctx), "/tmp/session-a.jsonl");
  });

  it("returns empty string when sessionFile is undefined", () => {
    const ctx = makeMockExtensionCtx({ sessionFile: undefined });
    assert.equal(orchestrator.getCurrentSessionFile(ctx), "");
  });

  it("trims control characters from returned value", () => {
    const ctx = {
      sessionManager: { getSessionFile: () => "  /tmp/dirty\n\r\tpath.jsonl  " },
    };
    assert.equal(orchestrator.getCurrentSessionFile(ctx), "/tmp/dirtypath.jsonl");
  });

  it("returns empty string when getSessionFile is not a function", () => {
    const ctx = { sessionManager: {} };
    assert.equal(orchestrator.getCurrentSessionFile(ctx), "");
  });

  it("returns empty string when getSessionFile throws", () => {
    const ctx = {
      sessionManager: {
        getSessionFile: () => {
          throw new Error("boom");
        },
      },
    };
    assert.equal(orchestrator.getCurrentSessionFile(ctx), "");
  });

  it("returns empty string when getSessionFile returns a non-string", () => {
    const ctx = {
      sessionManager: {
        getSessionFile: (() => 123) as unknown as () => string,
      },
    };
    assert.equal(orchestrator.getCurrentSessionFile(ctx), "");
  });
});

// ━━━ isInOriginSession ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("isInOriginSession", () => {
  it("returns true when current matches origin", () => {
    const ctx = makeMockExtensionCtx({ sessionFile: "/tmp/s.jsonl" });
    assert.equal(orchestrator.isInOriginSession(ctx, "/tmp/s.jsonl"), true);
  });

  it("returns false when current differs from origin", () => {
    const ctx = makeMockExtensionCtx({ sessionFile: "/tmp/other.jsonl" });
    assert.equal(orchestrator.isInOriginSession(ctx, "/tmp/s.jsonl"), false);
  });

  it("returns true when current session is empty (no session)", () => {
    const ctx = makeMockExtensionCtx({ sessionFile: undefined });
    assert.equal(orchestrator.isInOriginSession(ctx, "/tmp/s.jsonl"), true);
  });

  it("returns true when origin is empty", () => {
    const ctx = makeMockExtensionCtx({ sessionFile: "/tmp/s.jsonl" });
    assert.equal(orchestrator.isInOriginSession(ctx, ""), true);
  });
});

// ━━━ makePendingCompletion ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("makePendingCompletion", () => {
  it("wraps message with deliverAs=followUp and triggerTurn=true by default", () => {
    const message = {
      customType: "subagent-tool",
      content: "done",
      display: true,
      details: { foo: "bar" },
    };
    const pending = orchestrator.makePendingCompletion(message);
    assert.deepEqual(pending.message, message);
    assert.equal(pending.options.deliverAs, "followUp");
    assert.equal(pending.options.triggerTurn, true);
    assert.equal(typeof pending.createdAt, "number");
  });

  it("accepts triggerTurn=false override", () => {
    const message = {
      customType: "t",
      content: "c",
      display: false,
      details: {},
    };
    const pending = orchestrator.makePendingCompletion(message, false);
    assert.equal(pending.options.triggerTurn, false);
  });
});

// ━━━ registerRunLaunch ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("registerRunLaunch", () => {
  it("creates a new runState when no existingRunState", () => {
    const store = createStore();
    const ctx = makeMockExtensionCtx();
    const runState = orchestrator.registerRunLaunch(store, ctx, {
      agent: "worker",
      taskForDisplay: "hello task",
      taskForAgent: "wrapped hello task",
      inheritMainContext: false,
      originSessionFile: "/tmp/origin.jsonl",
      source: "tool",
    });
    assert.equal(runState.id, 1);
    assert.equal(runState.agent, "worker");
    assert.equal(runState.task, "hello task");
    assert.equal(runState.status, "running");
    assert.equal(runState.source, "tool");
    assert.equal(runState.contextMode, "isolated");
    assert.ok(runState.abortController);
    assert.ok(store.commandRuns.has(1));
    assert.ok(store.globalLiveRuns.has(1));
    assert.equal(store.recentLaunchTimestamps.get(1), runState.startedAt);
  });

  it("sets contextMode=main when inheritMainContext=true", () => {
    const store = createStore();
    const ctx = makeMockExtensionCtx();
    const runState = orchestrator.registerRunLaunch(store, ctx, {
      agent: "planner",
      taskForDisplay: "main ctx task",
      taskForAgent: "x",
      inheritMainContext: true,
      originSessionFile: "/tmp/o.jsonl",
      source: "tool",
    });
    assert.equal(runState.contextMode, "main");
  });

  it("records batchId, pipelineId and pipelineStepIndex when provided", () => {
    const store = createStore();
    const ctx = makeMockExtensionCtx();
    const runState = orchestrator.registerRunLaunch(store, ctx, {
      agent: "w",
      taskForDisplay: "t",
      taskForAgent: "t",
      inheritMainContext: false,
      originSessionFile: "/tmp/o.jsonl",
      source: "command",
      batchId: "b1",
      pipelineId: "p1",
      pipelineStepIndex: 3,
    });
    assert.equal(runState.batchId, "b1");
    assert.equal(runState.pipelineId, "p1");
    assert.equal(runState.pipelineStepIndex, 3);
    assert.equal(runState.source, "command");
  });

  it("resets and reuses existingRunState on continue", () => {
    const store = createStore();
    const ctx = makeMockExtensionCtx();
    const existing: CommandRunState = makeRun(42, {
      status: "done",
      turnCount: 2,
      toolCalls: 7,
      lastLine: "old",
      lastOutput: "old out",
      usage: {
        input: 1,
        output: 2,
        cacheRead: 0,
        cacheWrite: 0,
        cost: 0,
        contextTokens: 0,
        turns: 2,
      },
      model: "old-model",
      contextMode: "isolated",
      sessionFile: "/tmp/existing-session.jsonl",
      removed: true,
      continuedFromRunId: undefined,
    });
    store.commandRuns.set(42, existing);

    const result = orchestrator.registerRunLaunch(store, ctx, {
      agent: "newer",
      taskForDisplay: "continued task",
      taskForAgent: "x",
      inheritMainContext: true,
      originSessionFile: "/tmp/o.jsonl",
      source: "tool",
      continuedFromRunId: 41,
      existingRunState: existing,
    });
    assert.equal(result, existing);
    assert.equal(result.agent, "newer");
    assert.equal(result.task, "continued task");
    assert.equal(result.status, "running");
    assert.equal(result.toolCalls, 0);
    assert.equal(result.lastLine, "");
    assert.equal(result.lastOutput, "");
    assert.equal(result.removed, false);
    assert.equal(result.turnCount, 3); // max(1,2)+1
    assert.equal(result.continuedFromRunId, 41);
    assert.equal(result.sessionFile, "/tmp/existing-session.jsonl"); // reused
    // contextMode is preserved from existingRunState.contextMode (since it was set)
    assert.equal(result.contextMode, "isolated");
  });

  it("falls back to DEFAULT_TURN_COUNT when existingRunState.turnCount is 0", () => {
    const store = createStore();
    const ctx = makeMockExtensionCtx();
    const existing = makeRun(20, { turnCount: 0 });
    store.commandRuns.set(20, existing);
    const result = orchestrator.registerRunLaunch(store, ctx, {
      agent: "w",
      taskForDisplay: "t",
      taskForAgent: "t",
      inheritMainContext: false,
      originSessionFile: "/tmp/o.jsonl",
      source: "tool",
      existingRunState: existing,
    });
    // max(DEFAULT_TURN_COUNT=1, 0 || 1)+1 = max(1,1)+1 = 2
    assert.equal(result.turnCount, 2);
  });

  it("bumps turnCount using max(DEFAULT_TURN_COUNT, runState.turnCount)+1", () => {
    const store = createStore();
    const ctx = makeMockExtensionCtx();
    const existing = makeRun(10, { turnCount: 5 });
    store.commandRuns.set(10, existing);
    const result = orchestrator.registerRunLaunch(store, ctx, {
      agent: "w",
      taskForDisplay: "t",
      taskForAgent: "t",
      inheritMainContext: false,
      originSessionFile: "/tmp/o.jsonl",
      source: "tool",
      existingRunState: existing,
    });
    assert.equal(result.turnCount, 6);
  });

  it("sets contextMode to inheritMainContext when existingRunState has no contextMode", () => {
    const store = createStore();
    const ctx = makeMockExtensionCtx();
    const existing = makeRun(11, { contextMode: undefined });
    store.commandRuns.set(11, existing);
    const result = orchestrator.registerRunLaunch(store, ctx, {
      agent: "w",
      taskForDisplay: "t",
      taskForAgent: "t",
      inheritMainContext: true,
      originSessionFile: "/tmp/o.jsonl",
      source: "tool",
      existingRunState: existing,
    });
    assert.equal(result.contextMode, "main");
  });

  it("assigns a new sessionFile when existingRunState has none", () => {
    const store = createStore();
    const ctx = makeMockExtensionCtx();
    const existing = makeRun(12, { sessionFile: undefined });
    store.commandRuns.set(12, existing);
    const result = orchestrator.registerRunLaunch(store, ctx, {
      agent: "w",
      taskForDisplay: "t",
      taskForAgent: "t",
      inheritMainContext: false,
      originSessionFile: "/tmp/o.jsonl",
      source: "tool",
      existingRunState: existing,
    });
    assert.ok(result.sessionFile?.endsWith(".jsonl"));
  });

  it("stores commandWidgetCtx on the store", () => {
    const store = createStore();
    const ctx = makeMockExtensionCtx({ hasUI: false });
    orchestrator.registerRunLaunch(store, ctx, {
      agent: "w",
      taskForDisplay: "t",
      taskForAgent: "t",
      inheritMainContext: false,
      originSessionFile: "/tmp/o.jsonl",
      source: "tool",
    });
    assert.equal(store.commandWidgetCtx, ctx);
  });
});

// ━━━ deliverOrQueueCompletion ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("deliverOrQueueCompletion", () => {
  function makeMessage() {
    return {
      customType: "subagent-tool",
      content: "hello",
      display: true,
      details: {},
    };
  }

  it("delivers via pi.sendMessage when in origin session and cleans up by default", () => {
    const store = createStore();
    const ctx = makeMockExtensionCtx({ sessionFile: "/tmp/s.jsonl" });
    const pi = makeMockPi();
    // Register a live run so we can verify cleanup.
    store.globalLiveRuns.set(1, {
      runState: makeRun(1),
      abortController: new AbortController(),
      originSessionFile: "/tmp/s.jsonl",
    });
    store.recentLaunchTimestamps.set(1, Date.now());

    orchestrator.deliverOrQueueCompletion(pi, store, ctx, "/tmp/s.jsonl", 1, makeMessage(), {
      triggerTurn: true,
    });

    assert.equal(pi.sendMessage.mock.callCount(), 1);
    const call = pi.sendMessage.mock.calls[0];
    assert.ok(call);
    const [msgArg, optsArg] = call.arguments as [
      unknown,
      { deliverAs: string; triggerTurn: boolean },
    ];
    assert.deepEqual(msgArg, makeMessage());
    assert.equal(optsArg.deliverAs, "followUp");
    assert.equal(optsArg.triggerTurn, true);
    assert.equal(store.globalLiveRuns.has(1), false);
    assert.equal(store.recentLaunchTimestamps.has(1), false);
  });

  it("does not clean up when cleanupOnDeliver=false", () => {
    const store = createStore();
    const ctx = makeMockExtensionCtx({ sessionFile: "/tmp/s.jsonl" });
    const pi = makeMockPi();
    store.globalLiveRuns.set(2, {
      runState: makeRun(2),
      abortController: new AbortController(),
      originSessionFile: "/tmp/s.jsonl",
    });
    store.recentLaunchTimestamps.set(2, Date.now());

    orchestrator.deliverOrQueueCompletion(pi, store, ctx, "/tmp/s.jsonl", 2, makeMessage(), {
      triggerTurn: false,
      cleanupOnDeliver: false,
    });

    assert.equal(pi.sendMessage.mock.callCount(), 1);
    assert.equal(store.globalLiveRuns.has(2), true);
    assert.equal(store.recentLaunchTimestamps.has(2), true);
  });

  it("queues as pendingCompletion when session does not match", () => {
    const store = createStore();
    const ctx = makeMockExtensionCtx({ sessionFile: "/tmp/other.jsonl" });
    const pi = makeMockPi();
    const entry: GlobalRunEntry = {
      runState: makeRun(3),
      abortController: new AbortController(),
      originSessionFile: "/tmp/origin.jsonl",
    };
    store.globalLiveRuns.set(3, entry);

    orchestrator.deliverOrQueueCompletion(pi, store, ctx, "/tmp/origin.jsonl", 3, makeMessage(), {
      triggerTurn: true,
    });

    assert.equal(pi.sendMessage.mock.callCount(), 0);
    assert.ok(entry.pendingCompletion);
    assert.equal(entry.pendingCompletion?.options.triggerTurn, true);
    assert.deepEqual(entry.pendingCompletion?.message, makeMessage());
    // Should NOT have been cleaned up.
    assert.equal(store.globalLiveRuns.has(3), true);
  });

  it("queues with triggerTurn=false propagated to pending options", () => {
    const store = createStore();
    const ctx = makeMockExtensionCtx({ sessionFile: "/tmp/other.jsonl" });
    const pi = makeMockPi();
    const entry: GlobalRunEntry = {
      runState: makeRun(4),
      abortController: new AbortController(),
      originSessionFile: "/tmp/origin.jsonl",
    };
    store.globalLiveRuns.set(4, entry);
    orchestrator.deliverOrQueueCompletion(pi, store, ctx, "/tmp/origin.jsonl", 4, makeMessage(), {
      triggerTurn: false,
    });
    assert.equal(entry.pendingCompletion?.options.triggerTurn, false);
  });

  it("silently no-ops when the run has no globalLiveRuns entry (not in origin)", () => {
    const store = createStore();
    const ctx = makeMockExtensionCtx({ sessionFile: "/tmp/other.jsonl" });
    const pi = makeMockPi();
    // runId 99 does not exist in globalLiveRuns.
    orchestrator.deliverOrQueueCompletion(pi, store, ctx, "/tmp/origin.jsonl", 99, makeMessage(), {
      triggerTurn: true,
    });
    assert.equal(pi.sendMessage.mock.callCount(), 0);
  });
});

// ━━━ finalizeAndCleanup ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("finalizeAndCleanup", () => {
  it("clears abortController and invokes trim", () => {
    const store = createStore();
    const ctx = makeMockExtensionCtx();
    const pi = makeMockPi();
    const runState = makeRun(1, { abortController: new AbortController() });
    orchestrator.finalizeAndCleanup(store, runState, { ctx, pi });
    assert.equal(runState.abortController, undefined);
    // trimCommandRunHistory is invoked — exercises the finally path cleanly.
  });

  it("trims old completed runs beyond maxRuns=10", () => {
    const store = createStore();
    const ctx = makeMockExtensionCtx();
    const pi = makeMockPi();
    // Seed 12 done runs
    for (let i = 1; i <= 12; i++) {
      store.commandRuns.set(i, makeRun(i, { status: "done" }));
    }
    const runState = makeRun(13, { abortController: new AbortController(), status: "done" });
    store.commandRuns.set(13, runState);
    orchestrator.finalizeAndCleanup(store, runState, { ctx, pi });
    // Oldest should be trimmed down to 10
    const active = Array.from(store.commandRuns.values()).filter((r) => !r.removed);
    assert.ok(active.length <= 10);
  });
});
