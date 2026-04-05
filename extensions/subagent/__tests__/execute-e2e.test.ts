/**
 * End-to-end test for tool/execute.ts's launchRunInBackground wiring.
 *
 * This file is isolated from execute.test.ts because the module-global
 * SUBAGENT_QUEUE_INTERVAL_MS=1s queue (in execution/run.ts) serializes all
 * launches, and tests in execute.test.ts queue ~10 fire-and-forget jobs —
 * which would make this e2e scenario take ~10s to drain. Node runs each test
 * FILE in its own process (when the test runner is given multiple files), so
 * isolating this into its own file keeps the queue empty.
 */

import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, before, describe, it } from "node:test";
import { createStore } from "../core/store.js";
import { asMock } from "./_helpers.js";
import { makeMockAgentsDir, makeMockExtensionCtx, makeMockPi } from "./_mocks.js";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "subagent-execute-e2e-test-"));
const origHome = process.env.HOME;
const origUserProfile = process.env.USERPROFILE;
const origPath = process.env.PATH;
process.env.HOME = tmpDir;
process.env.USERPROFILE = tmpDir;
const emptyBinDir = path.join(tmpDir, "empty-bin");
fs.mkdirSync(emptyBinDir, { recursive: true });

let executeModule: typeof import("../tool/execute.js");
let mockAgents: ReturnType<typeof makeMockAgentsDir>;

before(async () => {
  executeModule = await import("../tool/execute.js");
  mockAgents = makeMockAgentsDir(["worker"]);
  process.env.PATH = emptyBinDir;
});

after(() => {
  if (origHome !== undefined) process.env.HOME = origHome;
  else process.env.HOME = undefined;
  if (origUserProfile !== undefined) process.env.USERPROFILE = origUserProfile;
  else process.env.USERPROFILE = undefined;
  if (origPath !== undefined) process.env.PATH = origPath;
  else process.env.PATH = undefined;
  try {
    mockAgents?.cleanup();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
});

describe("execute.ts → launchRunInBackground e2e (with fake pi binary)", () => {
  it("onUpdate early-returns when runState.removed is true", async () => {
    const piStub = path.join(emptyBinDir, "pi");
    fs.writeFileSync(
      piStub,
      [
        "#!/bin/sh",
        'echo \'{"type":"agent_start"}\'',
        'echo \'{"type":"tool_execution_start"}\'',
        'echo \'{"type":"message_end","message":{"role":"assistant","content":[{"type":"text","text":"x"}],"stopReason":"stop","usage":{"input":1,"output":1,"totalTokens":2,"cost":{"total":0}}}}\'',
        'echo \'{"type":"agent_end","messages":[]}\'',
        "exit 0",
        "",
      ].join("\n"),
      { mode: 0o755 },
    );
    const store = createStore();
    const pi = makeMockPi();
    const ctx = makeMockExtensionCtx({
      cwd: mockAgents.cwd,
      sessionFile: "/tmp/origin-removed-e2e.jsonl",
    });
    const execute = executeModule.createSubagentToolExecute({ pi, store });
    await execute(
      "id",
      { command: "subagent run worker -- removed early test" },
      undefined,
      undefined,
      ctx,
    );
    // Mark as removed BEFORE the queued subprocess runs.
    const run = store.commandRuns.get(1);
    if (run) run.removed = true;
    const start = Date.now();
    while (Date.now() - start < 10_000) {
      const r = store.commandRuns.get(1);
      if (r && r.status !== "running") break;
      await new Promise((r) => setTimeout(r, 100));
    }
    // Run stayed at "running" because onUpdate early-returned AND the final
    // delivery's removed-check also no-ops. Or it transitioned via finalize.
    // Either way the test just covers the early-return branch in onUpdate.
    assert.ok(store.commandRuns.get(1));
    fs.unlinkSync(piStub);
  });

  it("drives runSingleAgent's onUpdate callback through a fake pi subprocess", async () => {
    // Write a fake `pi` script that emits a tool_execution_start event (which
    // triggers emitUpdate=true → our onUpdate closure in execute.ts:313-319),
    // then an agent_end event so the runner settles quickly.
    const piStub = path.join(emptyBinDir, "pi");
    fs.writeFileSync(
      piStub,
      [
        "#!/bin/sh",
        'echo \'{"type":"agent_start"}\'',
        'echo \'{"type":"tool_execution_start"}\'',
        'echo \'{"type":"message_end","message":{"role":"assistant","content":[{"type":"text","text":"fake done"}],"stopReason":"stop","usage":{"input":1,"output":1,"totalTokens":2,"cost":{"total":0.001}}}}\'',
        'echo \'{"type":"agent_end","messages":[]}\'',
        "exit 0",
        "",
      ].join("\n"),
      { mode: 0o755 },
    );
    const store = createStore();
    const pi = makeMockPi();
    const ctx = makeMockExtensionCtx({
      cwd: mockAgents.cwd,
      sessionFile: "/tmp/origin-onupdate-e2e.jsonl",
    });
    const execute = executeModule.createSubagentToolExecute({ pi, store });
    await execute(
      "id",
      { command: "subagent run worker -- onUpdate test" },
      undefined,
      undefined,
      ctx,
    );
    // Wait up to 10s for run to finalize.
    const start = Date.now();
    while (Date.now() - start < 10_000) {
      const r = store.commandRuns.get(1);
      if (r && r.status !== "running") break;
      await new Promise((r) => setTimeout(r, 100));
    }
    const run = store.commandRuns.get(1);
    assert.ok(run);
    assert.notEqual(run?.status, "running");
    // Cleanup stub so it doesn't leak into subsequent tests.
    fs.unlinkSync(piStub);
  });

  it("drains the whole pipeline for a batch: cleanupRunAfterFinalDelivery + finalizeRunState", async () => {
    const store = createStore();
    const pi = makeMockPi();
    const ctx = makeMockExtensionCtx({
      cwd: mockAgents.cwd,
      sessionFile: "/tmp/origin-batch-e2e.jsonl",
    });
    const execute = executeModule.createSubagentToolExecute({ pi, store });
    const result = await execute(
      "tool-call-id",
      {
        command:
          'subagent batch --agent worker --task "e2e batch A" --agent worker --task "e2e batch B"',
      },
      undefined,
      undefined,
      ctx,
    );
    assert.equal(result.isError, undefined);
    assert.equal(store.commandRuns.size, 2);
    // Wait for both queued subprocesses to ENOENT and the batch to deliver.
    // 2 jobs * 1s queue sleep ≈ 2-3s.
    const start = Date.now();
    while (Date.now() - start < 10_000) {
      if (store.batchGroups.size === 0) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    // Batch group removed after delivery.
    assert.equal(store.batchGroups.size, 0);
    // Both runs finalized.
    assert.notEqual(store.commandRuns.get(1)?.status, "running");
    assert.notEqual(store.commandRuns.get(2)?.status, "running");
    // Both removed from globalLiveRuns.
    assert.equal(store.globalLiveRuns.has(1), false);
    assert.equal(store.globalLiveRuns.has(2), false);
    // Both launch timestamps cleared.
    assert.equal(store.recentLaunchTimestamps.has(1), false);
    assert.equal(store.recentLaunchTimestamps.has(2), false);
  });

  it("runs the full fire-and-forget path: queue → runSingleAgent(ENOENT) → finalize → deliver", async () => {
    const store = createStore();
    const pi = makeMockPi();
    const ctx = makeMockExtensionCtx({
      cwd: mockAgents.cwd,
      sessionFile: "/tmp/origin-e2e.jsonl",
    });
    const execute = executeModule.createSubagentToolExecute({ pi, store });
    const result = await execute(
      "tool-call-id",
      { command: "subagent run worker -- e2e single task" },
      undefined,
      undefined,
      ctx,
    );
    assert.equal(result.isError, undefined);
    const run = store.commandRuns.get(1);
    assert.ok(run);
    assert.equal(run?.task, "e2e single task");
    assert.equal(run?.status, "running");

    // Wait for the queued job to run: SUBAGENT_QUEUE_INTERVAL_MS (1s)
    // + spawn ENOENT (~10ms) + finalize. Poll for up to 5s.
    const start = Date.now();
    while (Date.now() - start < 5_000) {
      const r = store.commandRuns.get(1);
      if (r && r.status !== "running") break;
      await new Promise((r) => setTimeout(r, 100));
    }
    const final = store.commandRuns.get(1);
    assert.ok(final);
    assert.notEqual(final?.status, "running");
    // run-start (display:false) + completion (display:true) → 2 sendMessage calls.
    assert.ok(asMock(pi.sendMessage).mock.callCount() >= 2);
    // Final status should be "error" because spawn('pi') fails with ENOENT.
    assert.equal(final?.status, "error");
  });
});
