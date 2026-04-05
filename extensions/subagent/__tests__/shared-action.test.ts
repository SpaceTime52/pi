import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, afterEach, before, describe, it } from "node:test";
import { createStore } from "../core/store.js";
import type { GlobalRunEntry, PendingCompletion } from "../core/types.js";
import { asMock } from "./_helpers.js";
import { makeMockExtensionCtx, makeMockPi, makeRun } from "./_mocks.js";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "subagent-shared-action-test-"));
const origHome = process.env.HOME;
const origUserProfile = process.env.USERPROFILE;
process.env.HOME = tmpDir;
process.env.USERPROFILE = tmpDir;

let sharedActions: typeof import("../tool/actions/shared.js");
const stateFile = path.join(tmpDir, ".pi", "agent", "state", "subagent-pending-groups.json");

before(async () => {
  sharedActions = await import("../tool/actions/shared.js");
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

// ━━━ deliverGroupCompletion ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("deliverGroupCompletion", () => {
  it("delivers batch completion via pi.sendMessage when in origin session", () => {
    const store = createStore();
    const ctx = makeMockExtensionCtx({ sessionFile: "/tmp/origin.jsonl" });
    const pi = makeMockPi();
    const cleanupCalls: number[] = [];
    let deleted = false;
    let pendingSet: PendingCompletion | undefined;

    const run1 = makeRun(1, { status: "done" });
    const run2 = makeRun(2, { status: "done" });
    store.commandRuns.set(1, run1);
    store.commandRuns.set(2, run2);

    sharedActions.deliverGroupCompletion({
      scope: "batch",
      groupId: "b1",
      runIds: [1, 2],
      originSessionFile: "/tmp/origin.jsonl",
      contentText: "batch done",
      terminalStatus: "completed",
      orderedRuns: [run1, run2],
      store,
      ctx,
      pi,
      cleanupRunAfterFinalDelivery: (id) => cleanupCalls.push(id),
      deleteGroup: () => {
        deleted = true;
      },
      setPendingCompletion: (pending) => {
        pendingSet = pending;
      },
    });

    assert.equal(asMock(pi.sendMessage).mock.callCount(), 1);
    const sendArgs = asMock(pi.sendMessage).mock.calls[0]?.arguments as
      | [{ customType: string; details: Record<string, unknown> }, unknown]
      | undefined;
    assert.ok(sendArgs);
    assert.equal(sendArgs?.[0]?.customType, "subagent-tool");
    const details = sendArgs?.[0]?.details ?? {};
    assert.equal(details.batchId, "b1");
    assert.deepEqual(details.runIds, [1, 2]);
    assert.equal(details.status, "done"); // "completed" normalizes to "done"
    assert.deepEqual(cleanupCalls, [1, 2]);
    assert.equal(deleted, true);
    assert.equal(pendingSet, undefined);
  });

  it("delivers chain completion with pipelineId/stepRunIds", () => {
    const store = createStore();
    const ctx = makeMockExtensionCtx({ sessionFile: "/tmp/origin.jsonl" });
    const pi = makeMockPi();
    const run1 = makeRun(10, { status: "done" });
    store.commandRuns.set(10, run1);
    let deleted = false;

    sharedActions.deliverGroupCompletion({
      scope: "chain",
      groupId: "p1",
      runIds: [10],
      originSessionFile: "/tmp/origin.jsonl",
      contentText: "chain done",
      terminalStatus: "done",
      orderedRuns: [run1],
      store,
      ctx,
      pi,
      cleanupRunAfterFinalDelivery: () => undefined,
      deleteGroup: () => {
        deleted = true;
      },
      setPendingCompletion: () => undefined,
    });

    const sendArgs = asMock(pi.sendMessage).mock.calls[0]?.arguments as
      | [{ details: Record<string, unknown> }, unknown]
      | undefined;
    const details = sendArgs?.[0]?.details ?? {};
    assert.equal(details.pipelineId, "p1");
    assert.deepEqual(details.stepRunIds, [10]);
    assert.equal(details.status, "done");
    assert.equal(deleted, true);
  });

  it("preserves 'error' terminalStatus in delivered message", () => {
    const store = createStore();
    const ctx = makeMockExtensionCtx({ sessionFile: "/tmp/origin.jsonl" });
    const pi = makeMockPi();
    sharedActions.deliverGroupCompletion({
      scope: "batch",
      groupId: "b2",
      runIds: [],
      originSessionFile: "/tmp/origin.jsonl",
      contentText: "err",
      terminalStatus: "error",
      orderedRuns: [],
      store,
      ctx,
      pi,
      cleanupRunAfterFinalDelivery: () => undefined,
      deleteGroup: () => undefined,
      setPendingCompletion: () => undefined,
    });
    const sendArgs = asMock(pi.sendMessage).mock.calls[0]?.arguments as
      | [{ details: Record<string, unknown> }, unknown]
      | undefined;
    assert.equal(sendArgs?.[0]?.details.status, "error");
  });

  it("queues pendingCompletion when NOT in origin session", () => {
    const store = createStore();
    const ctx = makeMockExtensionCtx({ sessionFile: "/tmp/switched.jsonl" });
    const pi = makeMockPi();
    let pending: PendingCompletion | undefined;
    let deleted = false;
    const cleanupCalls: number[] = [];

    sharedActions.deliverGroupCompletion({
      scope: "batch",
      groupId: "bx",
      runIds: [5, 6],
      originSessionFile: "/tmp/origin.jsonl",
      contentText: "body",
      terminalStatus: "completed",
      orderedRuns: [],
      store,
      ctx,
      pi,
      cleanupRunAfterFinalDelivery: (id) => cleanupCalls.push(id),
      deleteGroup: () => {
        deleted = true;
      },
      setPendingCompletion: (p) => {
        pending = p;
      },
    });

    assert.equal(asMock(pi.sendMessage).mock.callCount(), 0);
    assert.ok(pending);
    assert.equal(deleted, false);
    assert.deepEqual(cleanupCalls, []);
    // Persisted to disk
    const persisted = JSON.parse(fs.readFileSync(stateFile, "utf-8"));
    assert.equal(persisted.length, 1);
    assert.equal(persisted[0].groupId, "bx");
    assert.equal(persisted[0].scope, "batch");
    assert.deepEqual(persisted[0].runIds, [5, 6]);
  });

  it("trims commandRuns history beyond 10 runs on delivery", () => {
    const store = createStore();
    const ctx = makeMockExtensionCtx({ sessionFile: "/tmp/origin.jsonl" });
    const pi = makeMockPi();
    // Seed 15 done runs
    for (let i = 1; i <= 15; i++) {
      store.commandRuns.set(i, makeRun(i, { status: "done" }));
    }
    sharedActions.deliverGroupCompletion({
      scope: "batch",
      groupId: "bt",
      runIds: [],
      originSessionFile: "/tmp/origin.jsonl",
      contentText: "done",
      terminalStatus: "completed",
      orderedRuns: [],
      store,
      ctx,
      pi,
      cleanupRunAfterFinalDelivery: () => undefined,
      deleteGroup: () => undefined,
      setPendingCompletion: () => undefined,
    });
    const active = Array.from(store.commandRuns.values()).filter((r) => !r.removed);
    assert.ok(active.length <= 10);
  });

  it("clears prior persisted pending-group entry on in-origin delivery", () => {
    const store = createStore();
    const ctx = makeMockExtensionCtx({ sessionFile: "/tmp/origin.jsonl" });
    const pi = makeMockPi();
    // Seed a persisted pending entry to verify it gets cleared.
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(
      stateFile,
      JSON.stringify([
        {
          scope: "batch",
          groupId: "bprior",
          originSessionFile: "/tmp/other.jsonl",
          runIds: [1],
          pendingCompletion: {
            message: { customType: "x", content: "c", display: true, details: {} },
            options: { deliverAs: "followUp", triggerTurn: true },
            createdAt: Date.now(),
          },
        },
      ]),
    );
    // Add an unrelated live run entry so we can verify cleanup path.
    const entry: GlobalRunEntry = {
      runState: makeRun(1),
      abortController: new AbortController(),
      originSessionFile: "/tmp/origin.jsonl",
    };
    store.globalLiveRuns.set(1, entry);
    sharedActions.deliverGroupCompletion({
      scope: "batch",
      groupId: "bprior",
      runIds: [1],
      originSessionFile: "/tmp/origin.jsonl",
      contentText: "done",
      terminalStatus: "completed",
      orderedRuns: [],
      store,
      ctx,
      pi,
      cleanupRunAfterFinalDelivery: (id) => store.globalLiveRuns.delete(id),
      deleteGroup: () => undefined,
      setPendingCompletion: () => undefined,
    });
    // After in-origin delivery, the persisted entry for bprior should be gone.
    const persisted = fs.existsSync(stateFile)
      ? JSON.parse(fs.readFileSync(stateFile, "utf-8"))
      : [];
    const stillThere = (persisted as { groupId: string }[]).some((e) => e.groupId === "bprior");
    assert.equal(stillThere, false);
  });
});
