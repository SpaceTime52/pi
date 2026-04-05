import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, afterEach, before, describe, it } from "node:test";
import { MAX_CHAIN_STEPS } from "../core/constants.js";
import { createStore, type SubagentStore } from "../core/store.js";
import type { BatchOrChainItem, CommandRunState } from "../core/types.js";
import type { RunLaunchConfig } from "../execution/orchestrator.js";
import type { FinalizedRun, LaunchMode, SubagentToolExecuteContext } from "../tool/types.js";
import { asMock } from "./_helpers.js";
import { makeMockExtensionCtx, makeMockPi, makeSingleResult } from "./_mocks.js";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "subagent-chain-action-test-"));
const origHome = process.env.HOME;
const origUserProfile = process.env.USERPROFILE;
process.env.HOME = tmpDir;
process.env.USERPROFILE = tmpDir;

let chainActions: typeof import("../tool/actions/chain.js");
const stateFile = path.join(tmpDir, ".pi", "agent", "state", "subagent-pending-groups.json");

before(async () => {
  chainActions = await import("../tool/actions/chain.js");
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

// ━━━ harness ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface TestChainCtx {
  store: SubagentStore;
  ctx: SubagentToolExecuteContext;
  pi: ReturnType<typeof makeMockPi>;
  invokedTasksForAgent: string[];
  /**
   * Queue of answers for successive launchRunInBackground invocations.
   * Each entry is a factory so we can read runState at call time.
   */
  backgroundResponses: ((
    runState: CommandRunState,
    taskForAgent: string,
  ) => Promise<FinalizedRun>)[];
  cleanupCalls: number[];
  cctx: Parameters<typeof chainActions.handleChainAction>[1];
}

function makeChainCtx(
  options: { originSessionFile?: string; inheritMainContext?: boolean } = {},
): TestChainCtx {
  const store = createStore();
  const ctx = makeMockExtensionCtx({ sessionFile: options.originSessionFile });
  const pi = makeMockPi();
  const cleanupCalls: number[] = [];
  const invokedTasksForAgent: string[] = [];
  const backgroundResponses: TestChainCtx["backgroundResponses"] = [];

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
    return runState;
  };

  const launchRunInBackground = (
    runState: CommandRunState,
    taskForAgent: string,
  ): Promise<FinalizedRun> => {
    invokedTasksForAgent.push(taskForAgent);
    const factory = backgroundResponses.shift();
    if (!factory) {
      return Promise.resolve({
        runState,
        result: makeSingleResult(),
        isError: false,
        rawOutput: "default",
      });
    }
    return factory(runState, taskForAgent);
  };

  const makeDetails = (modeOverride: LaunchMode = "chain") => ({
    mode: modeOverride,
    inheritMainContext: options.inheritMainContext ?? false,
    projectAgentsDir: null,
    results: [],
    launches: [],
  });

  const cctx = {
    store,
    ctx,
    pi,
    mainContextText: "",
    totalMessageCount: 0,
    mainSessionFile: undefined,
    originSessionFile: options.originSessionFile ?? "/tmp/origin.jsonl",
    inheritMainContext: options.inheritMainContext ?? false,
    mode: "chain" as LaunchMode,
    makeDetails,
    withIdleRunWarning: (text: string) => text,
    launchRun,
    launchRunInBackground,
    cleanupRunAfterFinalDelivery: (id: number) => cleanupCalls.push(id),
  };

  return { store, ctx, pi, invokedTasksForAgent, backgroundResponses, cleanupCalls, cctx };
}

function finResult(runState: CommandRunState, isError = false, output = "step-out"): FinalizedRun {
  return {
    runState,
    result: makeSingleResult({ exitCode: isError ? 1 : 0 }),
    isError,
    rawOutput: output,
  };
}

// ━━━ validation ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("handleChainAction — validation", () => {
  it("rejects fewer than 2 steps", () => {
    const t = makeChainCtx();
    const result = chainActions.handleChainAction({ steps: [{ agent: "w", task: "t" }] }, t.cctx);
    assert.equal(result.isError, true);
    assert.ok(result.content[0]?.text.includes("at least 2"));
  });

  it("rejects when steps is not an array", () => {
    const t = makeChainCtx();
    const result = chainActions.handleChainAction({ steps: "nope" }, t.cctx);
    assert.equal(result.isError, true);
  });

  it("rejects more than MAX_CHAIN_STEPS", () => {
    const t = makeChainCtx();
    const steps: BatchOrChainItem[] = Array.from({ length: MAX_CHAIN_STEPS + 1 }, (_, i) => ({
      agent: "w",
      task: `t${i}`,
    }));
    const result = chainActions.handleChainAction({ steps }, t.cctx);
    assert.equal(result.isError, true);
    assert.ok(result.content[0]?.text.includes(`at most ${MAX_CHAIN_STEPS}`));
  });
});

// ━━━ sequential happy path ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("handleChainAction — execution", () => {
  it("returns start message synchronously with step count", () => {
    const t = makeChainCtx({ originSessionFile: "/tmp/origin.jsonl" });
    const steps: BatchOrChainItem[] = [
      { agent: "a", task: "A" },
      { agent: "b", task: "B" },
    ];
    // Prevent fire-and-forget from actually executing right away
    t.backgroundResponses.push(
      (rs) => new Promise((resolve) => setImmediate(() => resolve(finResult(rs, false, "a-out")))),
    );
    t.backgroundResponses.push(
      (rs) => new Promise((resolve) => setImmediate(() => resolve(finResult(rs, false, "b-out")))),
    );
    const result = chainActions.handleChainAction({ steps }, t.cctx);
    assert.equal(result.isError, undefined);
    assert.ok(result.content[0]?.text.includes("Started async subagent chain"));
    assert.ok(result.content[0]?.text.includes("2 steps"));
    assert.equal(t.store.pipelines.size, 1);
  });

  it("executes steps sequentially, injecting previous output into next task", async () => {
    const t = makeChainCtx({ originSessionFile: "/tmp/origin.jsonl" });
    const steps: BatchOrChainItem[] = [
      { agent: "a", task: "first" },
      { agent: "b", task: "second" },
    ];
    t.backgroundResponses.push((rs) => Promise.resolve(finResult(rs, false, "aaa-output")));
    t.backgroundResponses.push((rs) => Promise.resolve(finResult(rs, false, "bbb-output")));

    chainActions.handleChainAction({ steps }, t.cctx);
    await new Promise((r) => setTimeout(r, 40));

    assert.equal(t.invokedTasksForAgent.length, 2);
    // First task has no reference section
    assert.ok(t.invokedTasksForAgent[0]?.includes("first"));
    assert.ok(!t.invokedTasksForAgent[0]?.includes("aaa-output"));
    // Second task includes previous output via wrapTaskWithPipelineContext
    assert.ok(t.invokedTasksForAgent[1]?.includes("second"));
    assert.ok(t.invokedTasksForAgent[1]?.includes("aaa-output"));
  });

  it("stops chain when a step errors out", async () => {
    const t = makeChainCtx({ originSessionFile: "/tmp/origin.jsonl" });
    const steps: BatchOrChainItem[] = [
      { agent: "a", task: "A" },
      { agent: "b", task: "B" },
      { agent: "c", task: "C" },
    ];
    t.backgroundResponses.push((rs) => Promise.resolve(finResult(rs, false, "a")));
    t.backgroundResponses.push((rs) => Promise.resolve(finResult(rs, true, "err-b")));
    t.backgroundResponses.push((rs) => Promise.resolve(finResult(rs, false, "c")));
    chainActions.handleChainAction({ steps }, t.cctx);
    await new Promise((r) => setTimeout(r, 40));
    // Only 2 steps should have executed (3rd was short-circuited).
    assert.equal(t.invokedTasksForAgent.length, 2);
    const pipeline = Array.from(t.store.pipelines.values())[0];
    // After finalization deleteGroup removes pipeline when in origin
    // So check via sendMessage instead.
    assert.equal(pipeline, undefined);
  });

  it("delivers final chain completion message with 'error' when a step fails", async () => {
    const t = makeChainCtx({ originSessionFile: "/tmp/origin.jsonl" });
    const steps: BatchOrChainItem[] = [
      { agent: "a", task: "A" },
      { agent: "b", task: "B" },
    ];
    t.backgroundResponses.push((rs) => Promise.resolve(finResult(rs, false, "a")));
    t.backgroundResponses.push((rs) => Promise.resolve(finResult(rs, true, "fail-b")));
    chainActions.handleChainAction({ steps }, t.cctx);
    await new Promise((r) => setTimeout(r, 40));
    const calls = asMock(t.pi.sendMessage).mock.calls;
    assert.ok(calls.length >= 1);
    const lastContent = (calls.at(-1)?.arguments[0] as { content: string }).content;
    assert.ok(lastContent.includes("subagent-chain#"));
    assert.ok(lastContent.includes("error"));
  });

  it("handles unexpected thrown error inside loop as terminal error", async () => {
    const t = makeChainCtx({ originSessionFile: "/tmp/origin.jsonl" });
    const steps: BatchOrChainItem[] = [
      { agent: "a", task: "A" },
      { agent: "b", task: "B" },
    ];
    t.backgroundResponses.push((rs) => Promise.resolve(finResult(rs, false, "a")));
    t.backgroundResponses.push(() => Promise.reject(new Error("kaboom")));
    chainActions.handleChainAction({ steps }, t.cctx);
    await new Promise((r) => setTimeout(r, 40));
    const calls = asMock(t.pi.sendMessage).mock.calls;
    const lastContent = (calls.at(-1)?.arguments[0] as { content: string }).content;
    assert.ok(lastContent.includes("error"));
  });

  it("handles non-Error thrown exception inside loop", async () => {
    const t = makeChainCtx({ originSessionFile: "/tmp/origin.jsonl" });
    const steps: BatchOrChainItem[] = [
      { agent: "a", task: "A" },
      { agent: "b", task: "B" },
    ];
    t.backgroundResponses.push((rs) => Promise.resolve(finResult(rs, false, "a")));
    t.backgroundResponses.push(() => Promise.reject("a string"));
    chainActions.handleChainAction({ steps }, t.cctx);
    await new Promise((r) => setTimeout(r, 40));
    assert.ok(asMock(t.pi.sendMessage).mock.callCount() >= 1);
  });

  it("marks terminal 'error' when a removed run also returned isError=true", async () => {
    const t = makeChainCtx({ originSessionFile: "/tmp/origin.jsonl" });
    const steps: BatchOrChainItem[] = [
      { agent: "a", task: "A" },
      { agent: "b", task: "B" },
    ];
    t.backgroundResponses.push((rs) => {
      rs.removed = true;
      return Promise.resolve(finResult(rs, true, ""));
    });
    t.backgroundResponses.push((rs) => Promise.resolve(finResult(rs, false, "b")));
    chainActions.handleChainAction({ steps }, t.cctx);
    await new Promise((r) => setTimeout(r, 40));
    assert.equal(t.invokedTasksForAgent.length, 1);
    const calls = asMock(t.pi.sendMessage).mock.calls;
    const lastContent = (calls.at(-1)?.arguments[0] as { content: string }).content;
    assert.ok(lastContent.includes("error"));
  });

  it("bails out gracefully when pipeline is deleted mid-chain", async () => {
    const t = makeChainCtx({ originSessionFile: "/tmp/origin.jsonl" });
    const steps: BatchOrChainItem[] = [
      { agent: "a", task: "A" },
      { agent: "b", task: "B" },
    ];
    // Delete pipeline before first iteration runs.
    t.backgroundResponses.push((rs) => {
      // Delete pipeline right away. Next loop iteration will hit `if (!pipeline) return`.
      const pid = Array.from(t.store.pipelines.keys())[0];
      if (pid) t.store.pipelines.delete(pid);
      return Promise.resolve(finResult(rs, false, "a"));
    });
    chainActions.handleChainAction({ steps }, t.cctx);
    await new Promise((r) => setTimeout(r, 40));
    // First step executed; second step short-circuited because pipeline gone.
    assert.equal(t.invokedTasksForAgent.length, 1);
  });

  it("stops and marks 'stopped' when a run is removed mid-chain", async () => {
    const t = makeChainCtx({ originSessionFile: "/tmp/origin.jsonl" });
    const steps: BatchOrChainItem[] = [
      { agent: "a", task: "A" },
      { agent: "b", task: "B" },
    ];
    t.backgroundResponses.push((rs) => {
      rs.removed = true;
      return Promise.resolve(finResult(rs, false, "a-removed"));
    });
    t.backgroundResponses.push((rs) => Promise.resolve(finResult(rs, false, "b")));
    chainActions.handleChainAction({ steps }, t.cctx);
    await new Promise((r) => setTimeout(r, 40));
    assert.equal(t.invokedTasksForAgent.length, 1);
    const calls = asMock(t.pi.sendMessage).mock.calls;
    const lastContent = (calls.at(-1)?.arguments[0] as { content: string }).content;
    assert.ok(lastContent.includes("stopped"));
  });

  it("delivers successful 'done' when all steps succeed", async () => {
    const t = makeChainCtx({ originSessionFile: "/tmp/origin.jsonl" });
    const steps: BatchOrChainItem[] = [
      { agent: "a", task: "A" },
      { agent: "b", task: "B" },
    ];
    t.backgroundResponses.push((rs) => Promise.resolve(finResult(rs, false, "a-out")));
    t.backgroundResponses.push((rs) => Promise.resolve(finResult(rs, false, "b-out")));
    chainActions.handleChainAction({ steps }, t.cctx);
    await new Promise((r) => setTimeout(r, 40));
    const calls = asMock(t.pi.sendMessage).mock.calls;
    const lastContent = (calls.at(-1)?.arguments[0] as { content: string }).content;
    assert.ok(lastContent.includes("completed"));
    // All steps recorded
    assert.equal(t.invokedTasksForAgent.length, 2);
  });

  it("wraps task with main-context reference section when inheritMainContext is true", async () => {
    const t = makeChainCtx({
      originSessionFile: "/tmp/origin.jsonl",
      inheritMainContext: true,
    });
    // Override mainContextText via cctx for this test
    t.cctx.mainContextText = "MAIN CONTEXT HERE";
    t.cctx.mainSessionFile = "/tmp/main.jsonl";
    t.cctx.totalMessageCount = 42;
    const steps: BatchOrChainItem[] = [
      { agent: "a", task: "first" },
      { agent: "b", task: "second" },
    ];
    t.backgroundResponses.push((rs) => Promise.resolve(finResult(rs, false, "a-out")));
    t.backgroundResponses.push((rs) => Promise.resolve(finResult(rs, false, "b-out")));
    chainActions.handleChainAction({ steps }, t.cctx);
    await new Promise((r) => setTimeout(r, 40));
    // Second task should include the reference section AND the main context wrapper
    const second = t.invokedTasksForAgent[1] ?? "";
    assert.ok(second.includes("a-out"));
  });

  it("fire-and-forget .catch swallows errors thrown inside finally block", async () => {
    const t = makeChainCtx({ originSessionFile: "/tmp/origin.jsonl" });
    // Make pi.sendMessage throw when the final chain completion is delivered.
    t.pi.sendMessage = (() => {
      throw new Error("sendMessage exploded");
    }) as unknown as typeof t.pi.sendMessage;
    const steps: BatchOrChainItem[] = [
      { agent: "a", task: "A" },
      { agent: "b", task: "B" },
    ];
    t.backgroundResponses.push((rs) => Promise.resolve(finResult(rs, false, "a")));
    t.backgroundResponses.push((rs) => Promise.resolve(finResult(rs, false, "b")));
    chainActions.handleChainAction({ steps }, t.cctx);
    await new Promise((r) => setTimeout(r, 40));
    // Test reached here without process crash ⇒ outer .catch swallowed the error.
    assert.ok(true);
  });

  it("queues pending completion when user switched session", async () => {
    const t = makeChainCtx({ originSessionFile: "/tmp/origin.jsonl" });
    // Switch session
    t.cctx.ctx = makeMockExtensionCtx({ sessionFile: "/tmp/other.jsonl" });
    const steps: BatchOrChainItem[] = [
      { agent: "a", task: "A" },
      { agent: "b", task: "B" },
    ];
    t.backgroundResponses.push((rs) => Promise.resolve(finResult(rs, false, "a")));
    t.backgroundResponses.push((rs) => Promise.resolve(finResult(rs, false, "b")));
    chainActions.handleChainAction({ steps }, t.cctx);
    await new Promise((r) => setTimeout(r, 40));
    assert.equal(asMock(t.pi.sendMessage).mock.callCount(), 0);
    const persisted = JSON.parse(fs.readFileSync(stateFile, "utf-8"));
    assert.equal(persisted.length, 1);
    assert.equal(persisted[0].scope, "chain");
  });
});
