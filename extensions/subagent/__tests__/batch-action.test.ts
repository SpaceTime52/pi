import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, afterEach, before, describe, it } from "node:test";
import { MAX_BATCH_RUNS } from "../core/constants.js";
import { createStore, type SubagentStore } from "../core/store.js";
import type { BatchOrChainItem, CommandRunState } from "../core/types.js";
import type { RunLaunchConfig } from "../execution/orchestrator.js";
import type { FinalizedRun, LaunchMode, SubagentToolExecuteContext } from "../tool/types.js";
import { asMock } from "./_helpers.js";
import { makeMockExtensionCtx, makeMockPi, makeSingleResult } from "./_mocks.js";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "subagent-batch-action-test-"));
const origHome = process.env.HOME;
const origUserProfile = process.env.USERPROFILE;
process.env.HOME = tmpDir;
process.env.USERPROFILE = tmpDir;

let batchActions: typeof import("../tool/actions/batch.js");
const stateFile = path.join(tmpDir, ".pi", "agent", "state", "subagent-pending-groups.json");

before(async () => {
  batchActions = await import("../tool/actions/batch.js");
});

afterEach(() => {
  try {
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

// ━━━ Test harness ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface BgSlot {
  resolve: (v: FinalizedRun) => void;
  reject: (e: unknown) => void;
  promise: Promise<FinalizedRun>;
}

interface TestBatchCtx {
  store: SubagentStore;
  ctx: SubagentToolExecuteContext;
  pi: ReturnType<typeof makeMockPi>;
  slots: Map<number, BgSlot>;
  cleanupCalls: number[];
  bctx: Parameters<typeof batchActions.handleBatchAction>[1];
}

function makeBatchCtx(options: { originSessionFile?: string } = {}): TestBatchCtx {
  const store = createStore();
  const ctx = makeMockExtensionCtx({ sessionFile: options.originSessionFile });
  const pi = makeMockPi();
  const slots = new Map<number, BgSlot>();
  const cleanupCalls: number[] = [];

  const launchRun = (config: Omit<RunLaunchConfig, "source">): CommandRunState => {
    const runId = store.nextCommandRunId++;
    const runState: CommandRunState = {
      id: runId,
      agent: config.agent,
      task: config.taskForDisplay,
      status: "running",
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
      elapsedMs: 0,
      toolCalls: 0,
      lastLine: "",
      turnCount: 1,
      abortController: new AbortController(),
      batchId: config.batchId,
      pipelineId: config.pipelineId,
      pipelineStepIndex: config.pipelineStepIndex,
      source: "tool",
      removed: false,
    };
    store.commandRuns.set(runId, runState);
    store.globalLiveRuns.set(runId, {
      runState,
      abortController: runState.abortController as AbortController,
      originSessionFile: config.originSessionFile,
    });
    let resolveFn!: (v: FinalizedRun) => void;
    let rejectFn!: (e: unknown) => void;
    const promise = new Promise<FinalizedRun>((res, rej) => {
      resolveFn = res;
      rejectFn = rej;
    });
    slots.set(runId, { resolve: resolveFn, reject: rejectFn, promise });
    return runState;
  };

  const launchRunInBackground = (runState: CommandRunState): Promise<FinalizedRun> => {
    const slot = slots.get(runState.id);
    if (!slot) throw new Error(`no slot for run ${runState.id}`);
    return slot.promise;
  };

  const makeDetails = (modeOverride: LaunchMode = "batch") => ({
    mode: modeOverride,
    inheritMainContext: false,
    projectAgentsDir: null,
    results: [],
    launches: [],
  });

  const bctx = {
    store,
    ctx,
    pi,
    mainContextText: "",
    totalMessageCount: 0,
    mainSessionFile: undefined,
    originSessionFile: options.originSessionFile ?? "/tmp/origin.jsonl",
    inheritMainContext: false,
    mode: "batch" as LaunchMode,
    makeDetails,
    withIdleRunWarning: (text: string) => text,
    launchRun,
    launchRunInBackground,
    cleanupRunAfterFinalDelivery: (id: number) => cleanupCalls.push(id),
  };

  return { store, ctx, pi, slots, cleanupCalls, bctx };
}

function finResult(runState: CommandRunState, isError = false, output = "done"): FinalizedRun {
  return {
    runState,
    result: makeSingleResult({ exitCode: isError ? 1 : 0 }),
    isError,
    rawOutput: output,
  };
}

// ━━━ validation ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("handleBatchAction — validation", () => {
  it("rejects fewer than 2 runs", () => {
    const t = makeBatchCtx();
    const result = batchActions.handleBatchAction({ runs: [{ agent: "x", task: "t" }] }, t.bctx);
    assert.equal(result.isError, true);
    assert.ok(result.content[0]?.text.includes("at least 2"));
  });

  it("rejects when runs is not an array", () => {
    const t = makeBatchCtx();
    const result = batchActions.handleBatchAction({ runs: "oops" }, t.bctx);
    assert.equal(result.isError, true);
  });

  it("rejects more than MAX_BATCH_RUNS", () => {
    const t = makeBatchCtx();
    const runs: BatchOrChainItem[] = Array.from({ length: MAX_BATCH_RUNS + 1 }, (_, i) => ({
      agent: "w",
      task: `t${i}`,
    }));
    const result = batchActions.handleBatchAction({ runs }, t.bctx);
    assert.equal(result.isError, true);
    assert.ok(result.content[0]?.text.includes(`at most ${MAX_BATCH_RUNS}`));
  });
});

// ━━━ happy path ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("handleBatchAction — launch", () => {
  it("creates batch group with N runs and returns start message", () => {
    const t = makeBatchCtx({ originSessionFile: "/tmp/origin.jsonl" });
    const runs: BatchOrChainItem[] = [
      { agent: "worker", task: "A" },
      { agent: "reviewer", task: "B" },
    ];
    const result = batchActions.handleBatchAction({ runs }, t.bctx);
    assert.equal(result.isError, undefined);
    assert.ok(result.content[0]?.text.includes("Started async subagent batch"));
    assert.equal(t.store.batchGroups.size, 1);
    const batch = Array.from(t.store.batchGroups.values())[0];
    assert.ok(batch);
    assert.equal(batch?.runIds.length, 2);
    assert.deepEqual(batch?.runIds, [1, 2]);
    // Verify each runState has its task preserved.
    assert.equal(t.store.commandRuns.get(1)?.task, "A");
    assert.equal(t.store.commandRuns.get(2)?.task, "B");
    assert.equal(t.store.commandRuns.get(1)?.agent, "worker");
    assert.equal(t.store.commandRuns.get(2)?.agent, "reviewer");
    assert.equal(t.store.commandRuns.get(1)?.pipelineStepIndex, 0);
    assert.equal(t.store.commandRuns.get(2)?.pipelineStepIndex, 1);
    // Resolve slots so fire-and-forget settles
    for (const [id, slot] of t.slots) {
      slot.resolve(finResult(t.store.commandRuns.get(id) as CommandRunState));
    }
  });

  it("delivers single batch completion after all runs finish (in origin)", async () => {
    const t = makeBatchCtx({ originSessionFile: "/tmp/origin.jsonl" });
    const runs: BatchOrChainItem[] = [
      { agent: "worker", task: "A" },
      { agent: "reviewer", task: "B" },
    ];
    batchActions.handleBatchAction({ runs }, t.bctx);
    // Resolve both
    t.slots
      .get(1)
      ?.resolve(finResult(t.store.commandRuns.get(1) as CommandRunState, false, "A-out"));
    t.slots
      .get(2)
      ?.resolve(finResult(t.store.commandRuns.get(2) as CommandRunState, false, "B-out"));
    await new Promise((r) => setTimeout(r, 20));
    // One sendMessage for the group completion (we don't emit run-start here).
    const calls = asMock(t.pi.sendMessage).mock.calls;
    assert.ok(calls.length >= 1);
    const lastCall = calls.at(-1);
    const content = (lastCall?.arguments[0] as { content: string }).content;
    assert.ok(content.includes("subagent-batch#"));
    assert.ok(content.includes("completed"));
    // Cleanup called for both
    assert.deepEqual(t.cleanupCalls.sort(), [1, 2]);
    // Batch group removed
    assert.equal(t.store.batchGroups.size, 0);
  });

  it("marks completion as error when any run fails", async () => {
    const t = makeBatchCtx({ originSessionFile: "/tmp/origin.jsonl" });
    const runs: BatchOrChainItem[] = [
      { agent: "worker", task: "A" },
      { agent: "reviewer", task: "B" },
    ];
    batchActions.handleBatchAction({ runs }, t.bctx);
    t.slots.get(1)?.resolve(finResult(t.store.commandRuns.get(1) as CommandRunState, false, "ok"));
    t.slots.get(2)?.resolve(finResult(t.store.commandRuns.get(2) as CommandRunState, true, "bad"));
    await new Promise((r) => setTimeout(r, 20));
    const calls = asMock(t.pi.sendMessage).mock.calls;
    const lastCall = calls.at(-1);
    const content = (lastCall?.arguments[0] as { content: string }).content;
    assert.ok(content.includes("error"));
  });

  it("recovers from per-run background rejection into a failing group", async () => {
    const t = makeBatchCtx({ originSessionFile: "/tmp/origin.jsonl" });
    const runs: BatchOrChainItem[] = [
      { agent: "worker", task: "A" },
      { agent: "reviewer", task: "B" },
    ];
    batchActions.handleBatchAction({ runs }, t.bctx);
    t.slots.get(1)?.resolve(finResult(t.store.commandRuns.get(1) as CommandRunState, false, "a"));
    t.slots.get(2)?.reject(new Error("boom"));
    await new Promise((r) => setTimeout(r, 20));
    // Batch still finalizes with error status
    assert.equal(t.store.batchGroups.size, 0);
    const run2 = t.store.commandRuns.get(2);
    assert.equal(run2?.status, "error");
    assert.ok(run2?.lastLine?.includes("boom"));
  });

  it("handles non-Error rejection as a failed run", async () => {
    const t = makeBatchCtx({ originSessionFile: "/tmp/origin.jsonl" });
    const runs: BatchOrChainItem[] = [
      { agent: "worker", task: "A" },
      { agent: "reviewer", task: "B" },
    ];
    batchActions.handleBatchAction({ runs }, t.bctx);
    t.slots.get(1)?.resolve(finResult(t.store.commandRuns.get(1) as CommandRunState));
    t.slots.get(2)?.reject("literal");
    await new Promise((r) => setTimeout(r, 20));
    const run2 = t.store.commandRuns.get(2);
    assert.equal(run2?.status, "error");
    assert.ok(run2?.lastLine?.includes("execution failed"));
  });

  it("no-ops on success path when batch group was deleted before completion (abandons)", async () => {
    const t = makeBatchCtx({ originSessionFile: "/tmp/origin.jsonl" });
    const runs: BatchOrChainItem[] = [
      { agent: "worker", task: "A" },
      { agent: "reviewer", task: "B" },
    ];
    batchActions.handleBatchAction({ runs }, t.bctx);
    // Simulate external deletion of the batch group before runs complete.
    const batchId = Array.from(t.store.batchGroups.keys())[0];
    assert.ok(batchId);
    if (batchId) t.store.batchGroups.delete(batchId);
    t.slots.get(1)?.resolve(finResult(t.store.commandRuns.get(1) as CommandRunState));
    t.slots.get(2)?.resolve(finResult(t.store.commandRuns.get(2) as CommandRunState));
    await new Promise((r) => setTimeout(r, 20));
    // No sendMessage was ever called — both async IIFEs returned early.
    assert.equal(asMock(t.pi.sendMessage).mock.callCount(), 0);
  });

  it("no-ops on error path when batch group was deleted before failure", async () => {
    const t = makeBatchCtx({ originSessionFile: "/tmp/origin.jsonl" });
    const runs: BatchOrChainItem[] = [
      { agent: "worker", task: "A" },
      { agent: "reviewer", task: "B" },
    ];
    batchActions.handleBatchAction({ runs }, t.bctx);
    const batchId = Array.from(t.store.batchGroups.keys())[0];
    assert.ok(batchId);
    if (batchId) t.store.batchGroups.delete(batchId);
    t.slots.get(1)?.reject(new Error("fail"));
    t.slots.get(2)?.reject(new Error("fail"));
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(asMock(t.pi.sendMessage).mock.callCount(), 0);
  });

  it("fire-and-forget .catch swallows secondary errors from delivery path", async () => {
    const t = makeBatchCtx({ originSessionFile: "/tmp/origin.jsonl" });
    // Make pi.sendMessage throw when deliverGroupCompletion tries to deliver.
    t.pi.sendMessage = (() => {
      throw new Error("sendMessage exploded");
    }) as unknown as typeof t.pi.sendMessage;
    const runs: BatchOrChainItem[] = [
      { agent: "worker", task: "A" },
      { agent: "reviewer", task: "B" },
    ];
    batchActions.handleBatchAction({ runs }, t.bctx);
    t.slots.get(1)?.resolve(finResult(t.store.commandRuns.get(1) as CommandRunState));
    t.slots.get(2)?.resolve(finResult(t.store.commandRuns.get(2) as CommandRunState));
    await new Promise((r) => setTimeout(r, 20));
    // Test reached here ⇒ outer .catch swallowed sendMessage error.
    assert.ok(true);
  });

  it("queues pending completion on failure-branch when user switched session", async () => {
    const t = makeBatchCtx({ originSessionFile: "/tmp/origin.jsonl" });
    // User switched session.
    t.bctx.ctx = makeMockExtensionCtx({ sessionFile: "/tmp/elsewhere.jsonl" });
    const runs: BatchOrChainItem[] = [
      { agent: "worker", task: "A" },
      { agent: "reviewer", task: "B" },
    ];
    batchActions.handleBatchAction({ runs }, t.bctx);
    // Reject both runs → catch branch fires, final-delivery happens in catch.
    t.slots.get(1)?.reject(new Error("r1"));
    t.slots.get(2)?.reject(new Error("r2"));
    await new Promise((r) => setTimeout(r, 20));
    // No sendMessage in origin-guard mode, pending persisted instead.
    assert.equal(asMock(t.pi.sendMessage).mock.callCount(), 0);
    // Batch group still present because pending queued; pendingCompletion set.
    const batch = Array.from(t.store.batchGroups.values())[0];
    assert.ok(batch?.pendingCompletion);
  });

  it("queues pending completion when user switched away from origin session", async () => {
    const t = makeBatchCtx({ originSessionFile: "/tmp/origin.jsonl" });
    // Simulate user in a different session.
    const ctxBackup = t.bctx.ctx;
    Object.assign(t.bctx, {
      ctx: makeMockExtensionCtx({ sessionFile: "/tmp/other.jsonl" }),
    });
    const runs: BatchOrChainItem[] = [
      { agent: "worker", task: "A" },
      { agent: "reviewer", task: "B" },
    ];
    batchActions.handleBatchAction({ runs }, t.bctx);
    t.slots.get(1)?.resolve(finResult(t.store.commandRuns.get(1) as CommandRunState));
    t.slots.get(2)?.resolve(finResult(t.store.commandRuns.get(2) as CommandRunState));
    await new Promise((r) => setTimeout(r, 20));
    // No sendMessage called
    assert.equal(asMock(t.pi.sendMessage).mock.callCount(), 0);
    // Pending persisted to state file
    const persisted = JSON.parse(fs.readFileSync(stateFile, "utf-8"));
    assert.equal(persisted.length, 1);
    assert.equal(persisted[0].scope, "batch");
    // Restore ctx for any afterEach cleanup references
    t.bctx.ctx = ctxBackup;
  });
});
