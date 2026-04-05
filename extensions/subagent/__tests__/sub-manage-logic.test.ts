import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CommandRunState } from "../core/types.js";
import {
  buildSubOpenCompletions,
  formatAvailableRunIds,
  formatHistoryFallbackLines,
  formatSubClearAllSummary,
  formatSubClearFinishedSummary,
  NO_ABORTABLE_SUBAGENT_JOBS,
  NO_RUNNING_SUBAGENT_JOBS,
  NO_SUBAGENT_HISTORY_YET,
  NO_SUBAGENT_RUNS_TO_REMOVE,
  NO_SUBAGENT_RUNS_YET,
  parseRunIdArg,
  parseSubClearMode,
  SUB_ABORT_USAGE,
  SUB_OPEN_USAGE,
  SUB_RM_USAGE,
  selectSubAbortTarget,
  selectSubClearTargets,
  sortRunsForHistory,
  validateSubAbortById,
} from "../register/commands/sub-manage-logic.js";
import { makeRun } from "./_mocks.js";

// ━━━ parseRunIdArg ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("parseRunIdArg", () => {
  it("returns empty for blank/undefined/null input", () => {
    assert.equal(parseRunIdArg("").kind, "empty");
    assert.equal(parseRunIdArg("   ").kind, "empty");
    assert.equal(parseRunIdArg(undefined).kind, "empty");
    assert.equal(parseRunIdArg(null).kind, "empty");
  });
  it("parses numeric id", () => {
    const out = parseRunIdArg("42");
    assert.equal(out.kind, "by-id");
    if (out.kind === "by-id") assert.equal(out.id, 42);
  });
  it("trims whitespace around numeric id", () => {
    const out = parseRunIdArg("  7  ");
    assert.equal(out.kind, "by-id");
    if (out.kind === "by-id") assert.equal(out.id, 7);
  });
  it("rejects non-numeric input", () => {
    assert.equal(parseRunIdArg("abc").kind, "invalid");
    assert.equal(parseRunIdArg("1,2").kind, "invalid");
    assert.equal(parseRunIdArg("1 2").kind, "invalid");
    assert.equal(parseRunIdArg("all").kind, "invalid");
    assert.equal(parseRunIdArg("1x").kind, "invalid");
  });
});

// ━━━ buildSubOpenCompletions ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("buildSubOpenCompletions", () => {
  it("returns null when argument contains a space", () => {
    assert.equal(buildSubOpenCompletions([makeRun(1)], "1 "), null);
  });
  it("returns null when there are no runs", () => {
    assert.equal(buildSubOpenCompletions([], ""), null);
  });
  it("sorts runs latest-first", () => {
    const runs = [makeRun(1), makeRun(3), makeRun(2)];
    const items = buildSubOpenCompletions(runs, "");
    assert.ok(items);
    assert.deepEqual(
      items?.map((c) => c.label),
      ["3", "2", "1"],
    );
  });
  it("filters by id prefix", () => {
    const runs = [makeRun(1), makeRun(10), makeRun(22)];
    const items = buildSubOpenCompletions(runs, "1");
    assert.ok(items);
    assert.deepEqual(items?.map((c) => c.label).sort(), ["1", "10"]);
  });
  it("returns the run's status and agent in the description", () => {
    const items = buildSubOpenCompletions(
      [makeRun(5, { status: "running", agent: "worker", task: "hi" })],
      "",
    );
    assert.ok(items);
    assert.ok(items?.[0]?.description?.includes("running worker"));
    assert.ok(items?.[0]?.description?.includes("hi"));
    assert.equal(items?.[0]?.value, "5");
  });
  it("caps at 20 items", () => {
    const runs: CommandRunState[] = [];
    for (let i = 1; i <= 30; i++) runs.push(makeRun(i));
    const items = buildSubOpenCompletions(runs, "");
    assert.ok(items);
    assert.equal(items?.length, 20);
  });
});

// ━━━ formatHistoryFallbackLines ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("formatHistoryFallbackLines", () => {
  it("produces one line per run with status + agent + task", () => {
    const lines = formatHistoryFallbackLines([
      makeRun(1, { status: "done", agent: "worker", task: "do thing", removed: false }),
      makeRun(2, { status: "running", agent: "reviewer", task: "review", removed: false }),
    ]);
    assert.equal(lines.length, 2);
    assert.ok(lines[0]?.includes("#1 [done] worker: do thing"));
    assert.ok(lines[1]?.includes("#2 [running] reviewer: review"));
  });
  it("flags removed runs", () => {
    const lines = formatHistoryFallbackLines([makeRun(3, { removed: true, status: "done" })]);
    assert.ok(lines[0]?.includes("[removed]"));
  });
  it("normalises multi-line tasks to single-line preview", () => {
    const lines = formatHistoryFallbackLines([
      makeRun(4, { task: "line1\n\nline2\n   line3", agent: "worker", status: "done" }),
    ]);
    assert.ok(lines[0]?.includes("line1 line2 line3"));
    assert.equal(lines[0]?.includes("\n"), false);
  });
  it("truncates task to 50 characters", () => {
    const lines = formatHistoryFallbackLines([
      makeRun(5, { task: "x".repeat(200), agent: "worker", status: "done" }),
    ]);
    // The task portion must be ≤ 50 chars
    const taskPart = lines[0]?.split(": ")[1] ?? "";
    assert.ok(taskPart.length <= 50);
  });
});

// ━━━ sortRunsForHistory ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("sortRunsForHistory", () => {
  it("sorts runs by startedAt descending (latest-first)", () => {
    const t0 = 1000;
    const sorted = sortRunsForHistory([
      makeRun(1, { startedAt: t0 + 10 }),
      makeRun(2, { startedAt: t0 + 50 }),
      makeRun(3, { startedAt: t0 + 30 }),
    ]);
    assert.deepEqual(
      sorted.map((r) => r.id),
      [2, 3, 1],
    );
  });
  it("returns a new array (does not mutate input)", () => {
    const input: CommandRunState[] = [makeRun(1), makeRun(2)];
    const sorted = sortRunsForHistory(input);
    assert.notEqual(sorted, input);
  });
});

// ━━━ parseSubClearMode ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("parseSubClearMode", () => {
  it('returns "all" when arg is "all" (case-insensitive)', () => {
    assert.equal(parseSubClearMode("all"), "all");
    assert.equal(parseSubClearMode("ALL"), "all");
    assert.equal(parseSubClearMode("  All  "), "all");
  });
  it('returns "finished-only" for anything else', () => {
    assert.equal(parseSubClearMode(""), "finished-only");
    assert.equal(parseSubClearMode(undefined), "finished-only");
    assert.equal(parseSubClearMode(null), "finished-only");
    assert.equal(parseSubClearMode("something"), "finished-only");
  });
});

// ━━━ selectSubClearTargets ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("selectSubClearTargets", () => {
  const runs = [
    makeRun(1, { status: "done" }),
    makeRun(2, { status: "running" }),
    makeRun(3, { status: "error" }),
  ];
  it('returns all runs in "all" mode', () => {
    const targets = selectSubClearTargets(runs, "all");
    assert.equal(targets.length, 3);
  });
  it('returns only non-running runs in "finished-only" mode', () => {
    const targets = selectSubClearTargets(runs, "finished-only");
    assert.deepEqual(targets.map((r) => r.id).sort(), [1, 3]);
  });
});

// ━━━ formatSubClearAllSummary / formatSubClearFinishedSummary ━━━━━━━━━━

describe("formatSubClearAllSummary", () => {
  it("mentions aborted runs when > 0", () => {
    assert.equal(
      formatSubClearAllSummary(3, 1),
      "Cleared 3 subagent job(s), aborting 1 running job(s).",
    );
  });
  it("omits aborted mention when aborted = 0", () => {
    assert.equal(formatSubClearAllSummary(2, 0), "Cleared 2 subagent job(s).");
  });
});

describe("formatSubClearFinishedSummary", () => {
  it("prints the count", () => {
    assert.equal(formatSubClearFinishedSummary(4), "Cleared 4 finished subagent job(s).");
  });
});

// ━━━ selectSubAbortTarget ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("selectSubAbortTarget", () => {
  it("returns none-running when no running runs exist", () => {
    const out = selectSubAbortTarget(
      [makeRun(1, { status: "done" }), makeRun(2, { status: "error" })],
      "",
    );
    assert.equal(out.kind, "none-running");
  });

  it("returns latest (highest id) running run when arg is empty", () => {
    const out = selectSubAbortTarget(
      [
        makeRun(1, { status: "running" }),
        makeRun(5, { status: "running" }),
        makeRun(3, { status: "running" }),
      ],
      "",
    );
    assert.equal(out.kind, "latest");
    if (out.kind === "latest") assert.equal(out.run.id, 5);
  });

  it("also returns latest when arg is undefined", () => {
    const out = selectSubAbortTarget([makeRun(2, { status: "running" })], undefined);
    assert.equal(out.kind, "latest");
    if (out.kind === "latest") assert.equal(out.run.id, 2);
  });

  it('returns all sorted running runs when arg is "all" (case-insensitive)', () => {
    const out = selectSubAbortTarget(
      [
        makeRun(1, { status: "running" }),
        makeRun(2, { status: "done" }),
        makeRun(3, { status: "running" }),
      ],
      "ALL",
    );
    assert.equal(out.kind, "all");
    if (out.kind === "all") {
      assert.deepEqual(
        out.runs.map((r) => r.id),
        [3, 1],
      );
    }
  });

  it("returns by-id when arg is numeric", () => {
    const out = selectSubAbortTarget([makeRun(1, { status: "running" })], "5");
    assert.equal(out.kind, "by-id");
    if (out.kind === "by-id") assert.equal(out.id, 5);
  });

  it("returns invalid when arg is neither id nor all", () => {
    const out = selectSubAbortTarget([makeRun(1, { status: "running" })], "abc");
    assert.equal(out.kind, "invalid");
  });
});

// ━━━ validateSubAbortById ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("validateSubAbortById", () => {
  it("returns unknown when run is undefined", () => {
    assert.equal(validateSubAbortById(undefined).kind, "unknown");
  });
  it("returns not-running when status is not running", () => {
    assert.equal(validateSubAbortById(makeRun(1, { status: "done" })).kind, "not-running");
    assert.equal(validateSubAbortById(makeRun(2, { status: "error" })).kind, "not-running");
  });
  it("returns ready with the run when status is running", () => {
    const run = makeRun(3, { status: "running" });
    const out = validateSubAbortById(run);
    assert.equal(out.kind, "ready");
    if (out.kind === "ready") assert.equal(out.run, run);
  });
});

// ━━━ formatAvailableRunIds ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("formatAvailableRunIds", () => {
  it("lists sorted ascending ids when runs are present", () => {
    const msg = formatAvailableRunIds([makeRun(3), makeRun(1), makeRun(2)]);
    assert.equal(msg, "Available run IDs: 1, 2, 3");
  });
  it("renders fallback message when empty", () => {
    assert.equal(formatAvailableRunIds([]), "No recent subagent runs available.");
  });
});

// ━━━ exported constants ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("exported messages", () => {
  it("are non-empty strings used by the wrappers", () => {
    for (const s of [
      SUB_OPEN_USAGE,
      SUB_RM_USAGE,
      SUB_ABORT_USAGE,
      NO_SUBAGENT_RUNS_YET,
      NO_SUBAGENT_RUNS_TO_REMOVE,
      NO_SUBAGENT_HISTORY_YET,
      NO_RUNNING_SUBAGENT_JOBS,
      NO_ABORTABLE_SUBAGENT_JOBS,
    ]) {
      assert.equal(typeof s, "string");
      assert.ok(s.length > 0);
    }
  });
});
