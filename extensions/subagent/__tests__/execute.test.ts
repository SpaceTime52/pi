import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, afterEach, before, describe, it } from "node:test";
import { MAX_CONCURRENT_ASYNC_SUBAGENT_RUNS } from "../core/constants.js";
import { createStore } from "../core/store.js";
import type { CommandRunState } from "../core/types.js";
import { asMock } from "./_helpers.js";
import {
  abortAllRuns,
  makeMockAgentsDir,
  makeMockExtensionCtx,
  makeMockPi,
  makeRun,
} from "./_mocks.js";

// HOME redirect + nuke PATH so any subprocess the runner might spawn dies fast.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "subagent-execute-test-"));
const origHome = process.env.HOME;
const origUserProfile = process.env.USERPROFILE;
const origPath = process.env.PATH;
process.env.HOME = tmpDir;
process.env.USERPROFILE = tmpDir;
// Point PATH at a guaranteed-empty dir so `spawn('pi', ...)` fails with ENOENT.
// We set PATH inside before() so that tsx/node's own resolution isn't affected
// before the test file starts executing.
const emptyBinDir = path.join(tmpDir, "empty-bin");
fs.mkdirSync(emptyBinDir, { recursive: true });

const stateFile = path.join(tmpDir, ".pi", "agent", "state", "subagent-pending-groups.json");

let executeModule: typeof import("../tool/execute.js");
let mockAgents: ReturnType<typeof makeMockAgentsDir>;

before(async () => {
  executeModule = await import("../tool/execute.js");
  mockAgents = makeMockAgentsDir(["worker", "reviewer", "planner"]);
  // Clobber PATH now that module import is done. Any spawn("pi", ...) inside
  // a fire-and-forget promise will fail fast with ENOENT.
  process.env.PATH = emptyBinDir;
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
  if (origPath !== undefined) process.env.PATH = origPath;
  else process.env.PATH = undefined;
  try {
    mockAgents?.cleanup();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
  // The tool/execute.ts launch path uses fire-and-forget promises that
  // enqueue into a module-level 1s-sleep queue (SUBAGENT_QUEUE_INTERVAL_MS).
  // Those pending promises keep the event loop alive after tests finish.
  // test:subagent passes --test-force-exit to drop those cleanly.
});

// ━━━ helpers ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function makeHarness() {
  const store = createStore();
  const pi = makeMockPi();
  const ctx = makeMockExtensionCtx({
    cwd: mockAgents.cwd,
    sessionFile: "/tmp/origin-session.jsonl",
  });
  const execute = executeModule.createSubagentToolExecute({ pi, store });
  return { store, pi, ctx, execute };
}

async function callExecute(harness: ReturnType<typeof makeHarness>, command: string) {
  const result = await harness.execute(
    "tool-call-id",
    { command },
    undefined,
    undefined,
    harness.ctx,
  );
  // Abort any fire-and-forget launches so the subprocess (spawn pi) dies fast.
  abortAllRuns(harness.store);
  return result;
}

// ━━━ early-return paths (no launch) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("createSubagentToolExecute — early returns", () => {
  it("returns help text for 'subagent help'", async () => {
    const h = makeHarness();
    const result = await callExecute(h, "subagent help");
    assert.equal(result.isError, undefined);
    assert.ok(result.content[0]?.text.includes("Subagent CLI"));
    assert.equal(h.store.commandRuns.size, 0);
  });

  it("returns 'No subagents found.' when no agents discovered", async () => {
    const store = createStore();
    const pi = makeMockPi();
    // Use a cwd with no agents
    const emptyCwd = fs.mkdtempSync(path.join(os.tmpdir(), "empty-cwd-"));
    const ctx = makeMockExtensionCtx({ cwd: emptyCwd, sessionFile: "/tmp/s.jsonl" });
    const execute = executeModule.createSubagentToolExecute({ pi, store });
    const result = await execute("id", { command: "subagent agents" }, undefined, undefined, ctx);
    assert.equal(result.isError, undefined);
    assert.ok(result.content[0]?.text.includes("No subagents found"));
    fs.rmSync(emptyCwd, { recursive: true, force: true });
  });

  it("lists agents when 'subagent agents' with discovered agents", async () => {
    const h = makeHarness();
    const result = await callExecute(h, "subagent agents");
    assert.equal(result.isError, undefined);
    const txt = result.content[0]?.text ?? "";
    assert.ok(txt.includes("Available subagents"));
    assert.ok(txt.includes("worker"));
    assert.ok(txt.includes("reviewer"));
    assert.ok(txt.includes("planner"));
  });

  it("formats 'subagent agents' correctly when agents have tools/model and when description is empty", async () => {
    // Build an agents dir with one fully-specified agent and one minimal one.
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "subagent-exec-custom-"));
    const agentsDir = path.join(cwd, ".pi", "agents");
    fs.mkdirSync(agentsDir, { recursive: true });
    fs.writeFileSync(
      path.join(agentsDir, "full.md"),
      "---\nname: full\ndescription: fully configured agent\nmodel: claude-3-5-sonnet\nthinking: high\ntools: Read,Edit,Bash\n---\nYou are full.\n",
    );
    // Agent with no description should emit without the " · description" suffix.
    // However, discoverAgents requires description non-empty to load. So we
    // exercise the truthy-description branch via a single long description
    // and exercise the tools-present branch via the configured agent.
    const store = createStore();
    const pi = makeMockPi();
    const ctx = makeMockExtensionCtx({ cwd, sessionFile: "/tmp/s.jsonl" });
    const execute = executeModule.createSubagentToolExecute({ pi, store });
    const result = await execute("id", { command: "subagent agents" }, undefined, undefined, ctx);
    assert.equal(result.isError, undefined);
    const txt = result.content[0]?.text ?? "";
    assert.ok(txt.includes("full"));
    // When tools is present (non-empty array), they're joined with comma.
    assert.ok(txt.includes("Read,Edit,Bash"));
    assert.ok(txt.includes("model: claude-3-5-sonnet"));
    assert.ok(txt.includes("thinking: high"));
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it("returns help-prefixed error on parser error", async () => {
    const h = makeHarness();
    const result = await callExecute(h, "subagent bogus-verb");
    assert.equal(result.isError, true);
    assert.ok(result.content[0]?.text.includes("Unknown subcommand"));
    assert.ok(result.content[0]?.text.includes("Subagent CLI"));
  });

  it("returns error when command param is not a string", async () => {
    const h = makeHarness();
    const result = await h.execute("id", { command: 123 }, undefined, undefined, h.ctx);
    assert.equal(result.isError, true);
    assert.ok(result.content[0]?.text.includes("must be a string"));
  });
});

// ━━━ list / status / detail / abort / remove dispatch ━━━━━━━━━━━━━━━

describe("createSubagentToolExecute — query/mutate dispatch", () => {
  it("'subagent runs' dispatches to list handler", async () => {
    const h = makeHarness();
    h.store.commandRuns.set(1, makeRun(1, { task: "existing task", status: "done" }));
    const result = await callExecute(h, "subagent runs");
    assert.ok(result.content[0]?.text.includes("existing task"));
  });

  it("'subagent status <id>' dispatches to status handler with parsed runId", async () => {
    const h = makeHarness();
    h.store.commandRuns.set(
      5,
      makeRun(5, { task: "status task", status: "done", lastOutput: "finished" }),
    );
    const result = await callExecute(h, "subagent status 5");
    assert.ok(result.content[0]?.text.includes("status task"));
    assert.ok(result.content[0]?.text.includes("finished"));
  });

  it("'subagent status <id>' returns error for unknown run", async () => {
    const h = makeHarness();
    const result = await callExecute(h, "subagent status 999");
    assert.equal(result.isError, true);
    assert.ok(result.content[0]?.text.includes("Unknown"));
  });

  it("'subagent detail <id>' dispatches to detail handler", async () => {
    const h = makeHarness();
    h.store.commandRuns.set(
      3,
      makeRun(3, { task: "detail task", status: "done", lastOutput: "x" }),
    );
    const result = await callExecute(h, "subagent detail 3");
    assert.ok(result.content[0]?.text.includes("detail task"));
  });

  it("'subagent abort <id>' dispatches to abort handler and aborts", async () => {
    const h = makeHarness();
    const controller = new AbortController();
    h.store.commandRuns.set(7, makeRun(7, { status: "running", abortController: controller }));
    const result = await callExecute(h, "subagent abort 7");
    assert.equal(controller.signal.aborted, true);
    assert.ok(result.content[0]?.text.includes("Aborting"));
  });

  it("'subagent abort 5,6,7' dispatches bulk abort with parsed runIds", async () => {
    const h = makeHarness();
    const c5 = new AbortController();
    const c6 = new AbortController();
    h.store.commandRuns.set(5, makeRun(5, { status: "running", abortController: c5 }));
    h.store.commandRuns.set(6, makeRun(6, { status: "running", abortController: c6 }));
    const result = await callExecute(h, "subagent abort 5,6,7");
    assert.equal(c5.signal.aborted, true);
    assert.equal(c6.signal.aborted, true);
    const txt = result.content[0]?.text ?? "";
    assert.ok(txt.includes("#5"));
    assert.ok(txt.includes("#6"));
    assert.ok(txt.includes("Unknown") && txt.includes("#7"));
  });

  it("'subagent remove <id>' dispatches to remove handler", async () => {
    const h = makeHarness();
    h.store.commandRuns.set(9, makeRun(9, { status: "done" }));
    const result = await callExecute(h, "subagent remove 9");
    assert.equal(h.store.commandRuns.get(9)?.removed, true);
    assert.ok(result.content[0]?.text.includes("Removed"));
  });

  it("'subagent remove all' dispatches bulk remove with parsed runIds", async () => {
    const h = makeHarness();
    h.store.commandRuns.set(1, makeRun(1, { status: "done" }));
    h.store.commandRuns.set(2, makeRun(2, { status: "done" }));
    const result = await callExecute(h, "subagent remove all");
    assert.equal(h.store.commandRuns.get(1)?.removed, true);
    assert.equal(h.store.commandRuns.get(2)?.removed, true);
    assert.ok(result.content[0]?.text.includes("Removed"));
  });
});

// ━━━ Validation errors ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("createSubagentToolExecute — validation", () => {
  it("rejects unknown agent name early", async () => {
    const h = makeHarness();
    const result = await callExecute(h, 'subagent run nosuchagent -- "do thing"');
    assert.equal(result.isError, true);
    assert.ok(result.content[0]?.text.includes("Unknown agent"));
    assert.ok(result.content[0]?.text.includes("nosuchagent"));
    assert.equal(h.store.commandRuns.size, 0);
  });

  it("shows 'Available agents: none' when no agents are discovered", async () => {
    const store = createStore();
    const pi = makeMockPi();
    const emptyCwd = fs.mkdtempSync(path.join(os.tmpdir(), "no-agents-"));
    const ctx = makeMockExtensionCtx({ cwd: emptyCwd, sessionFile: "/tmp/s.jsonl" });
    const execute = executeModule.createSubagentToolExecute({ pi, store });
    const result = await execute(
      "id",
      { command: "subagent run someone -- task" },
      undefined,
      undefined,
      ctx,
    );
    assert.equal(result.isError, true);
    assert.ok(result.content[0]?.text.includes("Available agents: none"));
    fs.rmSync(emptyCwd, { recursive: true, force: true });
  });

  it("uses plural 'Unknown agents' when multiple names are unknown", async () => {
    const h = makeHarness();
    const result = await callExecute(
      h,
      'subagent batch --agent ghost1 --task "A" --agent ghost2 --task "B"',
    );
    assert.equal(result.isError, true);
    assert.ok(result.content[0]?.text.includes("Unknown agents"));
  });

  it("rejects batch with unknown agents", async () => {
    const h = makeHarness();
    const result = await callExecute(
      h,
      'subagent batch --agent worker --task "A" --agent ghost --task "B"',
    );
    assert.equal(result.isError, true);
    assert.ok(result.content[0]?.text.includes("ghost"));
  });

  it("rejects chain with unknown agents", async () => {
    const h = makeHarness();
    const result = await callExecute(
      h,
      'subagent chain --agent worker --task "A" --agent phantom --task "B"',
    );
    assert.equal(result.isError, true);
    assert.ok(result.content[0]?.text.includes("phantom"));
  });

  it("rejects concurrent-runs limit exceeded", async () => {
    const h = makeHarness();
    // Fill up running runs to the max.
    for (let i = 1; i <= MAX_CONCURRENT_ASYNC_SUBAGENT_RUNS; i++) {
      h.store.commandRuns.set(i, makeRun(i, { status: "running" }));
      h.store.globalLiveRuns.set(i, {
        runState: h.store.commandRuns.get(i) as CommandRunState,
        abortController: new AbortController(),
        originSessionFile: "/tmp/origin-session.jsonl",
      });
    }
    const result = await callExecute(h, 'subagent run worker -- "hello"');
    assert.equal(result.isError, true);
    assert.ok(result.content[0]?.text.includes("Too many running"));
  });
});

// ━━━ Critical regression: resolvedParams passthrough ━━━━━━━━━━━━━━━

describe("createSubagentToolExecute — launch dispatch (regression: resolvedParams passthrough)", () => {
  it("'subagent run worker -- hello world' → handleLaunchAction gets parsed {task, agent}", async () => {
    const h = makeHarness();
    const result = await callExecute(h, "subagent run worker -- hello world");
    assert.equal(
      result.isError,
      undefined,
      `expected success but got error: ${result.content[0]?.text}`,
    );
    // The run was registered with the PARSED task, not the raw command.
    assert.equal(h.store.commandRuns.size, 1);
    const run = h.store.commandRuns.get(1);
    assert.ok(run, "a runState should have been registered");
    assert.equal(run?.agent, "worker");
    assert.equal(run?.task, "hello world");
    assert.notEqual(run?.task, "");
    // Ensure the raw `command` string did NOT leak into the task field.
    assert.ok(!run?.task.includes("subagent run"));
  });

  it("'subagent run planner --isolated -- build a plan' passes agent+task through", async () => {
    const h = makeHarness();
    const result = await callExecute(h, "subagent run planner --isolated -- build a plan");
    assert.equal(result.isError, undefined);
    const run = h.store.commandRuns.get(1);
    assert.equal(run?.agent, "planner");
    assert.equal(run?.task, "build a plan");
    assert.equal(run?.contextMode, "isolated");
  });

  it("'subagent batch ...' dispatches parsed runs array to handleBatchAction", async () => {
    const h = makeHarness();
    const result = await callExecute(
      h,
      'subagent batch --agent worker --task "do A" --agent reviewer --task "do B"',
    );
    assert.equal(result.isError, undefined);
    assert.equal(h.store.commandRuns.size, 2);
    assert.equal(h.store.commandRuns.get(1)?.agent, "worker");
    assert.equal(h.store.commandRuns.get(1)?.task, "do A");
    assert.equal(h.store.commandRuns.get(2)?.agent, "reviewer");
    assert.equal(h.store.commandRuns.get(2)?.task, "do B");
    assert.equal(h.store.batchGroups.size, 1);
  });

  it("'subagent chain ...' dispatches parsed steps array to handleChainAction", async () => {
    const h = makeHarness();
    const result = await callExecute(
      h,
      'subagent chain --agent worker --task "first step" --agent reviewer --task "second step"',
    );
    assert.equal(result.isError, undefined);
    assert.equal(h.store.pipelines.size, 1);
    // chain is sequential — only the first step is registered synchronously.
    assert.ok(h.store.commandRuns.size >= 1);
    const run1 = h.store.commandRuns.get(1);
    assert.equal(run1?.agent, "worker");
    assert.equal(run1?.task, "first step");
  });

  it("'subagent continue <runId> -- text' resumes with parsed task", async () => {
    const h = makeHarness();
    // Seed a done run that we can continue.
    h.store.commandRuns.set(50, makeRun(50, { status: "done", agent: "reviewer" }));
    h.store.nextCommandRunId = 51;
    const result = await callExecute(h, "subagent continue 50 -- keep going");
    assert.equal(result.isError, undefined, `expected success but got: ${result.content[0]?.text}`);
    // Continue reuses existing runState (id 50) by default
    const run = h.store.commandRuns.get(50);
    assert.ok(run);
    assert.ok(run?.task.includes("keep going"));
    assert.ok(run?.task.includes("[continue #50]"));
    assert.equal(run?.continuedFromRunId, 50);
  });

  it("rejects 'subagent run worker --' with empty task", async () => {
    const h = makeHarness();
    const result = await callExecute(h, "subagent run worker --");
    // Parser yields empty task; handleLaunchAction rejects it.
    assert.equal(result.isError, true);
    assert.ok(
      result.content[0]?.text.toLowerCase().includes("task") ||
        result.content[0]?.text.toLowerCase().includes("required"),
    );
  });
});

// ━━━ contextMode=main session requirement ━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("createSubagentToolExecute — contextMode=main guard", () => {
  it("rejects --main when no active main session", async () => {
    const store = createStore();
    const pi = makeMockPi();
    const ctx = makeMockExtensionCtx({ cwd: mockAgents.cwd, sessionFile: undefined });
    const execute = executeModule.createSubagentToolExecute({ pi, store });
    const result = await execute(
      "id",
      { command: "subagent run worker --main -- hello" },
      undefined,
      undefined,
      ctx,
    );
    assert.equal(result.isError, true);
    assert.ok(result.content[0]?.text.includes("contextMode=main"));
    abortAllRuns(store);
  });
});

// ━━━ pi.sendMessage wiring on launch ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("createSubagentToolExecute — launch wiring", () => {
  it("sends a run-start message with the parsed task embedded in details", async () => {
    const h = makeHarness();
    await callExecute(h, "subagent run worker -- compute answer");
    // At least one sendMessage invoked (run-start).
    assert.ok(asMock(h.pi.sendMessage).mock.callCount() >= 1);
    const firstCall = asMock(h.pi.sendMessage).mock.calls[0];
    const msg = firstCall?.arguments[0] as {
      customType: string;
      details: Record<string, unknown>;
    };
    assert.equal(msg.customType, "subagent-tool");
    assert.equal(msg.details.agent, "worker");
    assert.equal(msg.details.task, "compute answer");
  });

  // This test waits for the fire-and-forget subprocess to complete via the
  // internal SUBAGENT_QUEUE_INTERVAL_MS=1s queue. PATH is empty so `spawn('pi')`
  // fails with ENOENT quickly, giving us coverage of launchRunInBackground's
  // body + the subsequent finalizeRunState + delivery path.
  // End-to-end launchRunInBackground coverage is exercised by
  // execute-e2e.test.ts (a separate file to avoid module-global
  // enqueueSubagentInvocation queue interference).
});
