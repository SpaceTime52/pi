import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, afterEach, before, describe, it } from "node:test";
import { ESCALATION_EXIT_CODE } from "../core/constants.js";
import { createStore, type SubagentStore } from "../core/store.js";
import type { CommandRunState } from "../core/types.js";
import type { RunLaunchConfig } from "../execution/orchestrator.js";
import type { FinalizedRun, LaunchMode, SubagentToolExecuteContext } from "../tool/types.js";
import { asMock } from "./_helpers.js";
import {
  makeMockAgents,
  makeMockExtensionCtx,
  makeMockPi,
  makeRun,
  makeSingleResult,
} from "./_mocks.js";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "subagent-launch-action-test-"));
const origHome = process.env.HOME;
const origUserProfile = process.env.USERPROFILE;
process.env.HOME = tmpDir;
process.env.USERPROFILE = tmpDir;

let launchActions: typeof import("../tool/actions/launch.js");
const stateFile = path.join(tmpDir, ".pi", "agent", "state", "subagent-pending-groups.json");

before(async () => {
  launchActions = await import("../tool/actions/launch.js");
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

// ━━━ LaunchContext fixture ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface TestLaunchCtx {
  store: SubagentStore;
  ctx: SubagentToolExecuteContext;
  pi: ReturnType<typeof makeMockPi>;
  backgroundResolve: (value: FinalizedRun) => void;
  backgroundReject: (error: unknown) => void;
  backgroundPromise: Promise<FinalizedRun>;
  lctx: Parameters<typeof launchActions.handleLaunchAction>[1];
}

function makeLaunchCtx(
  options: {
    inheritMainContext?: boolean;
    originSessionFile?: string;
    mainSessionFile?: string;
  } = {},
): TestLaunchCtx {
  const store = createStore();
  const ctx = makeMockExtensionCtx({ sessionFile: options.originSessionFile });
  const pi = makeMockPi();

  let backgroundResolve!: (v: FinalizedRun) => void;
  let backgroundReject!: (e: unknown) => void;
  const backgroundPromise = new Promise<FinalizedRun>((resolve, reject) => {
    backgroundResolve = resolve;
    backgroundReject = reject;
  });

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
      continuedFromRunId: config.continuedFromRunId,
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

  const launchRunInBackground = (): Promise<FinalizedRun> => backgroundPromise;

  const makeDetails = (modeOverride: LaunchMode = "single") => ({
    mode: modeOverride,
    inheritMainContext: options.inheritMainContext ?? false,
    projectAgentsDir: null,
    results: [],
    launches: [],
  });

  const lctx = {
    store,
    ctx,
    pi,
    agents: makeMockAgents(),
    mainContextText: "",
    totalMessageCount: 0,
    mainSessionFile: options.mainSessionFile,
    originSessionFile: options.originSessionFile ?? "/tmp/origin.jsonl",
    inheritMainContext: options.inheritMainContext ?? false,
    mode: "single" as LaunchMode,
    makeDetails,
    withIdleRunWarning: (text: string) => text,
    launchRun,
    launchRunInBackground,
  };

  return { store, ctx, pi, backgroundResolve, backgroundReject, backgroundPromise, lctx };
}

// ━━━ tests ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("handleLaunchAction", () => {
  it("rejects when task is missing/empty", () => {
    const t = makeLaunchCtx();
    const result = launchActions.handleLaunchAction({ task: "" }, t.lctx);
    assert.equal(result.isError, true);
    assert.ok(result.content[0]?.text.includes("requires task"));
    assert.equal(t.store.commandRuns.size, 0);
  });

  it("rejects when task is not a string", () => {
    const t = makeLaunchCtx();
    const result = launchActions.handleLaunchAction({ task: 42 }, t.lctx);
    assert.equal(result.isError, true);
    assert.ok(result.content[0]?.text.includes("requires task"));
  });

  it("rejects when task is whitespace only", () => {
    const t = makeLaunchCtx();
    const result = launchActions.handleLaunchAction({ task: "   \t\n  " }, t.lctx);
    assert.equal(result.isError, true);
  });

  it("rejects continue with unknown runId", () => {
    const t = makeLaunchCtx();
    const result = launchActions.handleLaunchAction({ runId: 999, task: "go" }, t.lctx);
    assert.equal(result.isError, true);
    assert.ok(result.content[0]?.text.includes("#999"));
  });

  it("rejects continue when referenced run is still running", () => {
    const t = makeLaunchCtx();
    t.store.commandRuns.set(7, makeRun(7, { status: "running" }));
    const result = launchActions.handleLaunchAction({ runId: 7, task: "go" }, t.lctx);
    assert.equal(result.isError, true);
    assert.ok(result.content[0]?.text.includes("still running"));
  });

  it("launches a new run with agent+task and returns async-start message", async () => {
    const t = makeLaunchCtx({ originSessionFile: "/tmp/origin.jsonl" });
    const result = launchActions.handleLaunchAction(
      { agent: "worker", task: "hello world" },
      t.lctx,
    );
    assert.equal(result.isError, undefined);
    assert.equal(t.store.commandRuns.size, 1);
    const run = t.store.commandRuns.get(1);
    assert.ok(run);
    assert.equal(run?.agent, "worker");
    assert.equal(run?.task, "hello world");
    assert.equal(run?.status, "running");
    assert.ok(result.content[0]?.text.includes("Started async subagent run #1"));
    assert.ok(result.content[0]?.text.includes("worker"));
    // pi.sendMessage should be called once with the run-start message.
    assert.equal(asMock(t.pi.sendMessage).mock.callCount(), 1);
    // Resolve the background promise so .then() chain completes cleanly.
    t.backgroundResolve({
      runState: run as CommandRunState,
      result: makeSingleResult(),
      isError: false,
      rawOutput: "done",
    });
    await t.backgroundPromise.catch(() => undefined);
  });

  it("defaults agent to 'worker' when not specified and no continueFromRun", async () => {
    const t = makeLaunchCtx();
    const result = launchActions.handleLaunchAction({ task: "anon" }, t.lctx);
    assert.equal(result.isError, undefined);
    assert.equal(t.store.commandRuns.get(1)?.agent, "worker");
    t.backgroundResolve({
      runState: t.store.commandRuns.get(1) as CommandRunState,
      result: makeSingleResult(),
      isError: false,
      rawOutput: "ok",
    });
    await t.backgroundPromise.catch(() => undefined);
  });

  it("resumes existing run via continueFromRunId and uses its agent", async () => {
    const t = makeLaunchCtx();
    t.store.commandRuns.set(5, makeRun(5, { status: "done", agent: "reviewer" }));
    const result = launchActions.handleLaunchAction({ runId: 5, task: "resume" }, t.lctx);
    assert.equal(result.isError, undefined);
    assert.ok(result.content[0]?.text.includes("Resumed"));
    const run = t.store.commandRuns.get(1);
    assert.ok(run);
    assert.equal(run?.agent, "reviewer");
    assert.equal(run?.continuedFromRunId, 5);
    assert.ok(run?.task.includes("[continue #5]"));
    assert.ok(run?.task.includes("resume"));
    t.backgroundResolve({
      runState: run as CommandRunState,
      result: makeSingleResult(),
      isError: false,
      rawOutput: "ok",
    });
    await t.backgroundPromise.catch(() => undefined);
  });

  it("allows agent override when resuming a continue", async () => {
    const t = makeLaunchCtx();
    t.store.commandRuns.set(6, makeRun(6, { status: "done", agent: "reviewer" }));
    launchActions.handleLaunchAction({ runId: 6, agent: "planner", task: "do" }, t.lctx);
    assert.equal(t.store.commandRuns.get(1)?.agent, "planner");
    t.backgroundResolve({
      runState: t.store.commandRuns.get(1) as CommandRunState,
      result: makeSingleResult(),
      isError: false,
      rawOutput: "",
    });
    await t.backgroundPromise.catch(() => undefined);
  });

  it("delivers completion message via pi.sendMessage on successful background finish", async () => {
    const t = makeLaunchCtx({ originSessionFile: "/tmp/origin.jsonl" });
    launchActions.handleLaunchAction({ agent: "worker", task: "hello" }, t.lctx);
    const run = t.store.commandRuns.get(1) as CommandRunState;
    t.backgroundResolve({
      runState: run,
      result: makeSingleResult({ exitCode: 0 }),
      isError: false,
      rawOutput: "final output",
    });
    // Wait for the fire-and-forget microtask chain to finish.
    await new Promise((r) => setTimeout(r, 10));
    // There should be at least 2 sendMessage calls: run-start + run-completion.
    const count = asMock(t.pi.sendMessage).mock.callCount();
    assert.ok(count >= 2, `expected >=2 sendMessage calls, got ${count}`);
  });

  it("delivers escalation message on ESCALATION_EXIT_CODE", async () => {
    const t = makeLaunchCtx({ originSessionFile: "/tmp/origin.jsonl" });
    launchActions.handleLaunchAction({ agent: "worker", task: "escalate task" }, t.lctx);
    const run = t.store.commandRuns.get(1) as CommandRunState;
    t.backgroundResolve({
      runState: run,
      result: makeSingleResult({ exitCode: ESCALATION_EXIT_CODE }),
      isError: true,
      rawOutput: "[ESCALATION] need help",
    });
    await new Promise((r) => setTimeout(r, 10));
    const calls = asMock(t.pi.sendMessage).mock.calls.map(
      (c) => (c.arguments[0] as { content: string }).content,
    );
    assert.ok(
      calls.some((c) => c.includes("escalated")),
      `expected an escalation message, got: ${calls.join("|")}`,
    );
  });

  it("handles background rejection as run error", async () => {
    const t = makeLaunchCtx({ originSessionFile: "/tmp/origin.jsonl" });
    launchActions.handleLaunchAction({ agent: "worker", task: "fail" }, t.lctx);
    const run = t.store.commandRuns.get(1) as CommandRunState;
    t.backgroundReject(new Error("spawn failed"));
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(run.status, "error");
    assert.ok(run.lastLine?.includes("spawn failed"));
  });

  it("fire-and-forget .catch() catches secondary errors from sendMessage during failure handling", async () => {
    const t = makeLaunchCtx({ originSessionFile: "/tmp/origin.jsonl" });
    // Have sendMessage throw on subsequent calls so the catch's deliverOrQueueCompletion fails.
    let callCount = 0;
    t.pi.sendMessage = ((_msg: unknown, _opts: unknown) => {
      callCount++;
      if (callCount >= 2) throw new Error("sendMessage blew up");
      return undefined;
    }) as typeof t.pi.sendMessage;
    launchActions.handleLaunchAction({ agent: "worker", task: "boom" }, t.lctx);
    t.backgroundReject(new Error("background failure"));
    // Wait for fire-and-forget to settle — outer .catch should swallow.
    await new Promise((r) => setTimeout(r, 20));
    // No assertion error thrown out: the .catch swallowed the secondary error.
    // If we got here without process crash, the branch was hit.
    assert.ok(true);
  });

  it("handles background rejection with non-Error exception gracefully", async () => {
    const t = makeLaunchCtx({ originSessionFile: "/tmp/origin.jsonl" });
    launchActions.handleLaunchAction({ agent: "worker", task: "fail" }, t.lctx);
    const run = t.store.commandRuns.get(1) as CommandRunState;
    t.backgroundReject("plain string");
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(run.status, "error");
    assert.ok(run.lastLine?.includes("execution failed"));
  });

  it("skips completion delivery if runState is removed before background completes", async () => {
    const t = makeLaunchCtx({ originSessionFile: "/tmp/origin.jsonl" });
    launchActions.handleLaunchAction({ agent: "worker", task: "x" }, t.lctx);
    const run = t.store.commandRuns.get(1) as CommandRunState;
    const sendCountBefore = asMock(t.pi.sendMessage).mock.callCount();
    run.removed = true;
    t.backgroundResolve({
      runState: run,
      result: makeSingleResult(),
      isError: false,
      rawOutput: "ok",
    });
    await new Promise((r) => setTimeout(r, 10));
    // Should not have grown from run-start (count 1); no completion message.
    const sendCountAfter = asMock(t.pi.sendMessage).mock.callCount();
    assert.equal(sendCountAfter, sendCountBefore);
  });

  it("skips error delivery when run is removed during background failure", async () => {
    const t = makeLaunchCtx({ originSessionFile: "/tmp/origin.jsonl" });
    launchActions.handleLaunchAction({ agent: "worker", task: "x" }, t.lctx);
    const run = t.store.commandRuns.get(1) as CommandRunState;
    run.removed = true;
    const before = asMock(t.pi.sendMessage).mock.callCount();
    t.backgroundReject(new Error("boom"));
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(asMock(t.pi.sendMessage).mock.callCount(), before);
  });
});
