import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, before, describe, it } from "node:test";
import { createStore } from "../core/store.js";
import type { GlobalRunEntry, SubagentDetails } from "../core/types.js";
import type { LaunchMode } from "../tool/types.js";
import { asMock } from "./_helpers.js";
import { makeMockExtensionCtx, makeMockPi, makeRun } from "./_mocks.js";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "subagent-mutate-test-"));
const origHome = process.env.HOME;
const origUserProfile = process.env.USERPROFILE;
process.env.HOME = tmpDir;
process.env.USERPROFILE = tmpDir;

let mutateActions: typeof import("../tool/actions/mutate.js");

before(async () => {
  mutateActions = await import("../tool/actions/mutate.js");
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

function makeDetailsFactory(): (modeOverride?: LaunchMode) => SubagentDetails {
  return (modeOverride?: LaunchMode) => ({
    mode: modeOverride ?? "single",
    inheritMainContext: false,
    projectAgentsDir: null,
    results: [],
    launches: [],
  });
}

// ━━━ handleAbortAction ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("handleAbortAction", () => {
  it("aborts a single running run with attached controller", () => {
    const store = createStore();
    const ctx = makeMockExtensionCtx();
    const controller = new AbortController();
    store.commandRuns.set(1, makeRun(1, { status: "running", abortController: controller }));
    const result = mutateActions.handleAbortAction([1], store, ctx, makeDetailsFactory());
    assert.equal(controller.signal.aborted, true);
    assert.ok(result.content[0]?.text.includes("Aborting subagent run #1"));
    assert.equal(result.isError, undefined);
    const run = store.commandRuns.get(1);
    assert.equal(run?.lastLine, "Aborting by subagent tool...");
  });

  it("falls back to globalLiveRuns controller when runState has none", () => {
    const store = createStore();
    const ctx = makeMockExtensionCtx();
    const controller = new AbortController();
    const run = makeRun(2, { status: "running", abortController: undefined });
    store.commandRuns.set(2, run);
    const entry: GlobalRunEntry = {
      runState: run,
      abortController: controller,
      originSessionFile: "/tmp/o.jsonl",
    };
    store.globalLiveRuns.set(2, entry);
    mutateActions.handleAbortAction([2], store, ctx, makeDetailsFactory());
    assert.equal(controller.signal.aborted, true);
  });

  it("reports 'Not running' when run has no controller and status != running", () => {
    const store = createStore();
    const ctx = makeMockExtensionCtx();
    store.commandRuns.set(3, makeRun(3, { status: "done" }));
    const result = mutateActions.handleAbortAction([3], store, ctx, makeDetailsFactory());
    assert.ok(result.content[0]?.text.includes("Not running"));
    assert.ok(result.content[0]?.text.includes("#3"));
  });

  it("reports 'Unknown' when runId is not in store", () => {
    const store = createStore();
    const ctx = makeMockExtensionCtx();
    const result = mutateActions.handleAbortAction([99], store, ctx, makeDetailsFactory());
    assert.ok(result.content[0]?.text.includes("Unknown"));
    assert.ok(result.content[0]?.text.includes("#99"));
  });

  it("composes multi-line output for mixed results", () => {
    const store = createStore();
    const ctx = makeMockExtensionCtx();
    const c1 = new AbortController();
    store.commandRuns.set(1, makeRun(1, { status: "running", abortController: c1 }));
    store.commandRuns.set(2, makeRun(2, { status: "done" }));
    const result = mutateActions.handleAbortAction([1, 2, 99], store, ctx, makeDetailsFactory());
    const txt = result.content[0]?.text ?? "";
    assert.ok(txt.includes("Aborting: #1"));
    assert.ok(txt.includes("Not running: #2"));
    assert.ok(txt.includes("Unknown: #99"));
  });

  it("produces fallback 'No subagent runs matched.' when given empty list", () => {
    const store = createStore();
    const ctx = makeMockExtensionCtx();
    const result = mutateActions.handleAbortAction([], store, ctx, makeDetailsFactory());
    assert.ok(result.content[0]?.text.includes("No subagent runs matched."));
  });
});

// ━━━ handleRemoveAction ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("handleRemoveAction", () => {
  it("removes a single completed run cleanly", () => {
    const store = createStore();
    const ctx = makeMockExtensionCtx();
    const pi = makeMockPi();
    store.commandRuns.set(1, makeRun(1, { status: "done" }));
    const result = mutateActions.handleRemoveAction([1], store, ctx, pi, makeDetailsFactory());
    assert.equal(store.commandRuns.get(1)?.removed, true);
    assert.ok(result.content[0]?.text.includes("Removed subagent run #1"));
    assert.ok(!result.content[0]?.text.includes("aborting in background"));
  });

  it("removes a running run and notes background abort", () => {
    const store = createStore();
    const ctx = makeMockExtensionCtx();
    const pi = makeMockPi();
    const controller = new AbortController();
    store.commandRuns.set(2, makeRun(2, { status: "running", abortController: controller }));
    const result = mutateActions.handleRemoveAction([2], store, ctx, pi, makeDetailsFactory());
    assert.equal(controller.signal.aborted, true);
    assert.ok(result.content[0]?.text.includes("aborting in background"));
  });

  it("reports 'Unknown' when runId is not in store", () => {
    const store = createStore();
    const ctx = makeMockExtensionCtx();
    const pi = makeMockPi();
    const result = mutateActions.handleRemoveAction([77], store, ctx, pi, makeDetailsFactory());
    assert.ok(result.content[0]?.text.includes("Unknown"));
  });

  it("handles bulk: renders 'Aborting in background' line when a running run is removed", () => {
    const store = createStore();
    const ctx = makeMockExtensionCtx();
    const pi = makeMockPi();
    const c1 = new AbortController();
    store.commandRuns.set(1, makeRun(1, { status: "done" }));
    store.commandRuns.set(2, makeRun(2, { status: "running", abortController: c1 }));
    const result = mutateActions.handleRemoveAction([1, 2], store, ctx, pi, makeDetailsFactory());
    const txt = result.content[0]?.text ?? "";
    assert.ok(txt.includes("Removed: #1, #2"));
    assert.ok(txt.includes("Aborting in background: #2"));
  });

  it("handles bulk: mixes removed + unknown", () => {
    const store = createStore();
    const ctx = makeMockExtensionCtx();
    const pi = makeMockPi();
    store.commandRuns.set(1, makeRun(1));
    store.commandRuns.set(2, makeRun(2));
    const result = mutateActions.handleRemoveAction(
      [1, 2, 99],
      store,
      ctx,
      pi,
      makeDetailsFactory(),
    );
    const txt = result.content[0]?.text ?? "";
    assert.ok(txt.includes("Removed: #1, #2"));
    assert.ok(txt.includes("Unknown: #99"));
  });

  it("clears recentLaunchTimestamps entry for removed run", () => {
    const store = createStore();
    const ctx = makeMockExtensionCtx();
    const pi = makeMockPi();
    store.commandRuns.set(3, makeRun(3));
    store.recentLaunchTimestamps.set(3, Date.now());
    mutateActions.handleRemoveAction([3], store, ctx, pi, makeDetailsFactory());
    assert.equal(store.recentLaunchTimestamps.has(3), false);
  });

  it("calls pi.appendEntry with subagent-removed payload", () => {
    const store = createStore();
    const ctx = makeMockExtensionCtx();
    const pi = makeMockPi();
    store.commandRuns.set(4, makeRun(4));
    mutateActions.handleRemoveAction([4], store, ctx, pi, makeDetailsFactory());
    assert.ok(asMock(pi.appendEntry).mock.callCount() >= 1);
    const call = asMock(pi.appendEntry).mock.calls[0];
    assert.equal(call?.arguments[0], "subagent-removed");
  });

  it("produces fallback 'No subagent runs matched.' for empty list", () => {
    const store = createStore();
    const ctx = makeMockExtensionCtx();
    const pi = makeMockPi();
    const result = mutateActions.handleRemoveAction([], store, ctx, pi, makeDetailsFactory());
    assert.ok(result.content[0]?.text.includes("No subagent runs matched."));
  });

  it("treats runId as unknown when removeRun returns {removed:false} (race)", () => {
    const store = createStore();
    const ctx = makeMockExtensionCtx();
    const pi = makeMockPi();
    // Install a run, but intercept commandRuns.get so the first lookup (inside
    // handleRemoveAction) returns the run, while the second lookup (inside
    // removeRun) returns undefined. This simulates a concurrent deletion.
    const run = makeRun(1);
    store.commandRuns.set(1, run);
    let lookupCount = 0;
    const origGet = store.commandRuns.get.bind(store.commandRuns);
    store.commandRuns.get = ((id: number) => {
      lookupCount++;
      if (lookupCount === 2) return undefined; // second call: simulate race deletion
      return origGet(id);
    }) as typeof store.commandRuns.get;
    const result = mutateActions.handleRemoveAction([1], store, ctx, pi, makeDetailsFactory());
    assert.ok(result.content[0]?.text.includes("Unknown"));
    assert.ok(result.content[0]?.text.includes("#1"));
  });
});
