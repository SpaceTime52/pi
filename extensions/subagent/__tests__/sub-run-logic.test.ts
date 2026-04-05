import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AgentConfig, CommandRunState } from "../core/types.js";
import {
  agentExists,
  buildFallbackContinuationTask,
  buildResolvedDecisionFromAgent,
  buildRunContinuationCompletions,
  contextModeLabel,
  decideMainContextWrap,
  decideSubRun,
  formatAmbiguousAgentMessage,
  formatContinuationDisplay,
  formatContinuationUnknownAgentMessage,
  isLegacyMainPrefix,
  LEGACY_MAIN_PREFIX_WARNING,
  mergeSubRunCompletions,
  NO_AGENTS_FOUND_MESSAGE,
  parseSubRunArgs,
  resolveContinuationAgent,
  SUB_RUN_USAGE_TEXT,
  sanitiseSessionFilePath,
  startedStateLabel,
} from "../register/commands/sub-run-logic.js";
import { makeMockAgent, makeMockAgents, makeRun } from "./_mocks.js";

// ━━━ parseSubRunArgs ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("parseSubRunArgs", () => {
  it("returns empty parsed state for null/undefined/empty inputs", () => {
    for (const input of [null, undefined, "", "   "]) {
      const parsed = parseSubRunArgs(input);
      assert.equal(parsed.input, "");
      assert.equal(parsed.firstToken, "");
      assert.equal(parsed.firstSpace, -1);
      assert.equal(parsed.rest, undefined);
      assert.equal(parsed.isNumericFirstToken, false);
    }
  });

  it("parses single-token input without a task", () => {
    const parsed = parseSubRunArgs("worker");
    assert.equal(parsed.input, "worker");
    assert.equal(parsed.firstToken, "worker");
    assert.equal(parsed.firstSpace, -1);
    assert.equal(parsed.rest, undefined);
    assert.equal(parsed.isNumericFirstToken, false);
  });

  it("parses agent+task input", () => {
    const parsed = parseSubRunArgs("  worker   do this now  ");
    assert.equal(parsed.input, "worker   do this now");
    assert.equal(parsed.firstToken, "worker");
    assert.ok(parsed.firstSpace > 0);
    assert.equal(parsed.rest, "do this now");
    assert.equal(parsed.isNumericFirstToken, false);
  });

  it("detects a numeric first token", () => {
    const parsed = parseSubRunArgs("42 continue please");
    assert.equal(parsed.firstToken, "42");
    assert.equal(parsed.isNumericFirstToken, true);
    assert.equal(parsed.rest, "continue please");
  });

  it("treats bare numeric first token with no trailing text as numeric", () => {
    const parsed = parseSubRunArgs("7");
    assert.equal(parsed.firstToken, "7");
    assert.equal(parsed.isNumericFirstToken, true);
    assert.equal(parsed.firstSpace, -1);
    assert.equal(parsed.rest, undefined);
  });

  it("returns empty rest when trailing tokens are only whitespace", () => {
    const parsed = parseSubRunArgs("worker    ");
    assert.equal(parsed.input, "worker");
    assert.equal(parsed.rest, undefined);
  });

  it("does not treat hex-like tokens as numeric", () => {
    const parsed = parseSubRunArgs("0x1 task");
    assert.equal(parsed.isNumericFirstToken, false);
  });
});

// ━━━ isLegacyMainPrefix ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("isLegacyMainPrefix", () => {
  it("matches exactly --main", () => {
    assert.equal(isLegacyMainPrefix("--main"), true);
  });
  it("matches --main <args>", () => {
    assert.equal(isLegacyMainPrefix("--main worker do stuff"), true);
  });
  it("matches leading whitespace + --main", () => {
    assert.equal(isLegacyMainPrefix("  --main  worker"), true);
  });
  it("does not match --maine or main--", () => {
    assert.equal(isLegacyMainPrefix("--maine"), false);
    assert.equal(isLegacyMainPrefix("main--"), false);
  });
  it("handles null/undefined", () => {
    assert.equal(isLegacyMainPrefix(null), false);
    assert.equal(isLegacyMainPrefix(undefined), false);
    assert.equal(isLegacyMainPrefix(""), false);
  });
});

// ━━━ resolveContinuationAgent ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("resolveContinuationAgent", () => {
  it("returns direct agent name when lowercase-equal match exists", () => {
    const agents = makeMockAgents();
    assert.equal(resolveContinuationAgent(agents, "Worker"), "worker");
  });

  it("falls back to fuzzy match when no direct exists", () => {
    const agents = makeMockAgents();
    // "work" is a prefix fuzzy match for "worker"
    assert.equal(resolveContinuationAgent(agents, "work"), "worker");
  });

  it("returns the original name as last-resort fallback", () => {
    const agents = makeMockAgents();
    assert.equal(resolveContinuationAgent(agents, "nomatch-zzz"), "nomatch-zzz");
  });
});

// ━━━ agentExists ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("agentExists", () => {
  it("finds existing agents", () => {
    const agents = makeMockAgents();
    assert.equal(agentExists(agents, "worker"), true);
    assert.equal(agentExists(agents, "reviewer"), true);
  });
  it("returns false when no agent matches", () => {
    const agents = makeMockAgents();
    assert.equal(agentExists(agents, "Worker"), false); // case-sensitive
    assert.equal(agentExists(agents, "ghost"), false);
  });
});

// ━━━ buildFallbackContinuationTask ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("buildFallbackContinuationTask", () => {
  it("stitches together all the required sections", () => {
    const out = buildFallbackContinuationTask({
      targetRunId: 3,
      selectedAgent: "worker",
      previousTask: "task A",
      previousOutput: "earlier output",
      nextInstruction: "do more",
    });
    assert.ok(out.includes("Continue subagent run #3 using the same agent (worker)."));
    assert.ok(out.includes("Previous task:\ntask A"));
    assert.ok(out.includes("Previous output:\nearlier output"));
    assert.ok(out.includes("New instruction:\ndo more"));
  });

  it("replaces missing previous output with a fallback sentinel", () => {
    const out = buildFallbackContinuationTask({
      targetRunId: 3,
      selectedAgent: "worker",
      previousTask: "t",
      previousOutput: "",
      nextInstruction: "n",
    });
    assert.ok(out.includes("Previous output: (not available)"));
  });

  it("truncates long previous output at the configured threshold", () => {
    const bigOutput = "x".repeat(6_050);
    const out = buildFallbackContinuationTask({
      targetRunId: 1,
      selectedAgent: "worker",
      previousTask: "t",
      previousOutput: bigOutput,
      nextInstruction: "n",
    });
    assert.ok(out.includes("... [truncated]"));
    // Output still contains the 6000-char prefix.
    assert.ok(out.includes("x".repeat(6_000)));
    // But the full 6050-char string no longer fits verbatim.
    assert.equal(out.includes(bigOutput), false);
  });
});

// ━━━ formatContinuationDisplay ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("formatContinuationDisplay", () => {
  it("prepends a [continue #id] marker", () => {
    assert.equal(formatContinuationDisplay(7, "next step"), "[continue #7] next step");
  });
});

// ━━━ decideSubRun ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("decideSubRun", () => {
  const agents = makeMockAgents();
  const emptyGet = (_id: number) => undefined;

  it("flags legacy --main prefix", () => {
    const d = decideSubRun("--main worker hi", { agents, getRun: emptyGet });
    assert.equal(d.kind, "legacy-main-prefix");
  });

  it("treats empty input as empty-input", () => {
    const d = decideSubRun("  ", { agents, getRun: emptyGet });
    assert.equal(d.kind, "empty-input");
  });

  it("flags no-agents-found", () => {
    const d = decideSubRun("worker do x", { agents: [], getRun: emptyGet });
    assert.equal(d.kind, "no-agents-found");
  });

  it("requires a task after a run id", () => {
    const runs = new Map<number, CommandRunState>();
    runs.set(5, makeRun(5, { agent: "worker", status: "done" }));
    const d = decideSubRun("5", { agents, getRun: (id) => runs.get(id) });
    assert.equal(d.kind, "usage-missing-task");
  });

  it("returns continuation-target-running when target is running", () => {
    const runs = new Map<number, CommandRunState>();
    runs.set(9, makeRun(9, { agent: "worker", status: "running" }));
    const d = decideSubRun("9 keep going", { agents, getRun: (id) => runs.get(id) });
    assert.equal(d.kind, "continuation-target-running");
    if (d.kind === "continuation-target-running") {
      assert.equal(d.targetRunId, 9);
    }
  });

  it("returns usage-missing-task when run id has whitespace-only remainder", () => {
    const runs = new Map<number, CommandRunState>();
    runs.set(1, makeRun(1, { agent: "worker", status: "done" }));
    // "1  " → firstSpace is 1, rest is "" → usage-missing-task
    const d = decideSubRun("1  ", { agents, getRun: (id) => runs.get(id) });
    assert.equal(d.kind, "usage-missing-task");
  });

  it("returns continuation-target-unknown-agent when previous agent vanished", () => {
    const runs = new Map<number, CommandRunState>();
    runs.set(2, makeRun(2, { agent: "ghost", status: "done" }));
    const d = decideSubRun("2 keep going", { agents, getRun: (id) => runs.get(id) });
    assert.equal(d.kind, "continuation-target-unknown-agent");
    if (d.kind === "continuation-target-unknown-agent") {
      assert.equal(d.targetRunId, 2);
      assert.equal(d.previousAgentName, "ghost");
    }
  });

  it("returns true-continuation when target run has session file", () => {
    const runs = new Map<number, CommandRunState>();
    runs.set(11, makeRun(11, { agent: "worker", status: "done", sessionFile: "/tmp/s.jsonl" }));
    const d = decideSubRun("11 keep going", { agents, getRun: (id) => runs.get(id) });
    assert.equal(d.kind, "continuation");
    if (d.kind === "continuation") {
      assert.equal(d.reusesSessionFile, true);
      assert.equal(d.targetRunId, 11);
      assert.equal(d.selectedAgent, "worker");
      assert.equal(d.taskForDisplay, "[continue #11] keep going");
      assert.equal(d.taskForAgent, "keep going");
    }
  });

  it("returns fallback-continuation when target run lacks session file", () => {
    const runs = new Map<number, CommandRunState>();
    runs.set(12, makeRun(12, { agent: "worker", status: "done", lastOutput: "prev out" }));
    const d = decideSubRun("12 next thing", { agents, getRun: (id) => runs.get(id) });
    assert.equal(d.kind, "continuation");
    if (d.kind === "continuation") {
      assert.equal(d.reusesSessionFile, false);
      assert.ok(d.taskForAgent.includes("Previous task:"));
      assert.ok(d.taskForAgent.includes("New instruction:\nnext thing"));
      assert.ok(d.taskForAgent.includes("Previous output:\nprev out"));
    }
  });

  it("fallback continuation uses lastLine when lastOutput missing", () => {
    const runs = new Map<number, CommandRunState>();
    runs.set(
      13,
      makeRun(13, {
        agent: "worker",
        status: "done",
        lastOutput: undefined,
        lastLine: "line-echo",
      }),
    );
    const d = decideSubRun("13 next", { agents, getRun: (id) => runs.get(id) });
    if (d.kind === "continuation") {
      assert.ok(d.taskForAgent.includes("Previous output:\nline-echo"));
    } else {
      assert.fail("expected continuation");
    }
  });

  it("fallback continuation falls back to (not available) when both lastOutput and lastLine empty", () => {
    const runs = new Map<number, CommandRunState>();
    runs.set(
      14,
      makeRun(14, { agent: "worker", status: "done", lastOutput: undefined, lastLine: "" }),
    );
    const d = decideSubRun("14 keep", { agents, getRun: (id) => runs.get(id) });
    if (d.kind === "continuation") {
      assert.ok(d.taskForAgent.includes("Previous output: (not available)"));
    } else {
      assert.fail("expected continuation");
    }
  });

  it("numeric first token with no matching run falls through to new-run dispatch", () => {
    const d = decideSubRun("999 do this job", { agents, getRun: emptyGet });
    // 999 doesn't match any agent either, so it's the worker-fallback path.
    assert.equal(d.kind, "resolved");
    if (d.kind === "resolved") {
      assert.equal(d.selectedAgent, "worker");
      assert.equal(d.taskForDisplay, "999 do this job");
      assert.equal(d.taskForAgent, "999 do this job");
    }
  });

  it("dispatches to the matched agent with task", () => {
    const d = decideSubRun("worker do this", { agents, getRun: emptyGet });
    assert.equal(d.kind, "resolved");
    if (d.kind === "resolved") {
      assert.equal(d.selectedAgent, "worker");
      assert.equal(d.taskForDisplay, "do this");
      assert.equal(d.taskForAgent, "do this");
    }
  });

  it("returns usage-missing-task when matched agent has no task", () => {
    const d = decideSubRun("worker", { agents, getRun: emptyGet });
    assert.equal(d.kind, "usage-missing-task");
  });

  it("returns ambiguous-agent when multiple agents share the alias and task is present", () => {
    const ambiguousAgents: AgentConfig[] = [
      makeMockAgent({ name: "reviewer" }),
      makeMockAgent({ name: "reactor" }),
    ];
    const d = decideSubRun("re task here", { agents: ambiguousAgents, getRun: emptyGet });
    assert.equal(d.kind, "ambiguous-agent");
    if (d.kind === "ambiguous-agent") {
      assert.equal(d.firstToken, "re");
      assert.equal(d.ambiguousAgents.length, 2);
      assert.equal(d.taskProvided, true);
    }
  });

  it("returns ambiguous-agent with taskProvided=false when no task given", () => {
    const ambiguousAgents: AgentConfig[] = [
      makeMockAgent({ name: "reviewer" }),
      makeMockAgent({ name: "reactor" }),
    ];
    const d = decideSubRun("re", { agents: ambiguousAgents, getRun: emptyGet });
    assert.equal(d.kind, "ambiguous-agent");
    if (d.kind === "ambiguous-agent") {
      assert.equal(d.taskProvided, false);
    }
  });

  it("defaults to worker and treats full input as task when no agent matched", () => {
    const d = decideSubRun("fix the login bug", { agents, getRun: emptyGet });
    assert.equal(d.kind, "resolved");
    if (d.kind === "resolved") {
      assert.equal(d.selectedAgent, "worker");
      assert.equal(d.taskForDisplay, "fix the login bug");
      assert.equal(d.taskForAgent, "fix the login bug");
    }
  });
});

// ━━━ buildResolvedDecisionFromAgent ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("buildResolvedDecisionFromAgent", () => {
  it("returns resolved with selected agent and tail task", () => {
    const out = buildResolvedDecisionFromAgent("worker", "alias do the thing");
    assert.equal(out.kind, "resolved");
    if (out.kind === "resolved") {
      assert.equal(out.selectedAgent, "worker");
      assert.equal(out.taskForDisplay, "do the thing");
      assert.equal(out.taskForAgent, "do the thing");
    }
  });

  it("returns usage-missing-task on single-token input", () => {
    assert.equal(buildResolvedDecisionFromAgent("worker", "alias").kind, "usage-missing-task");
  });

  it("returns usage-missing-task when task is whitespace-only", () => {
    assert.equal(buildResolvedDecisionFromAgent("worker", "alias   ").kind, "usage-missing-task");
  });

  it("handles null/undefined inputs", () => {
    assert.equal(buildResolvedDecisionFromAgent("worker", null).kind, "usage-missing-task");
    assert.equal(buildResolvedDecisionFromAgent("worker", undefined).kind, "usage-missing-task");
  });
});

// ━━━ buildRunContinuationCompletions ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("buildRunContinuationCompletions", () => {
  it("returns [] when argument contains a space", () => {
    const out = buildRunContinuationCompletions([makeRun(1)], "1 some text");
    assert.deepEqual(out, []);
  });

  it("sorts runs latest-first", () => {
    const out = buildRunContinuationCompletions([makeRun(1), makeRun(5), makeRun(3)], "");
    assert.deepEqual(
      out.map((c) => c.label),
      ["5", "3", "1"],
    );
  });

  it("filters by id prefix", () => {
    const runs = [makeRun(1), makeRun(2), makeRun(10), makeRun(11)];
    const out = buildRunContinuationCompletions(runs, "1");
    assert.deepEqual(out.map((c) => c.label).sort(), ["1", "10", "11"]);
  });

  it("caps at COMMAND_COMPLETION_LIMIT", () => {
    const runs: CommandRunState[] = [];
    for (let i = 1; i <= 30; i++) runs.push(makeRun(i));
    const out = buildRunContinuationCompletions(runs, "");
    assert.equal(out.length, 20);
  });

  it("includes task preview in description", () => {
    const out = buildRunContinuationCompletions(
      [makeRun(7, { agent: "worker", task: "do the thing" })],
      "",
    );
    assert.equal(out.length, 1);
    assert.ok(out[0]?.description?.includes("continue worker"));
    assert.ok(out[0]?.description?.includes("do the thing"));
    assert.equal(out[0]?.value, "7 ");
  });
});

// ━━━ mergeSubRunCompletions ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("mergeSubRunCompletions", () => {
  it("returns null when argument contains a space", () => {
    const out = mergeSubRunCompletions(
      [{ value: "x", label: "x" }],
      [{ value: "y", label: "y" }],
      "worker ",
    );
    assert.equal(out, null);
  });

  it("returns null when both lists are empty", () => {
    assert.equal(mergeSubRunCompletions([], [], ""), null);
  });

  it("concatenates runs first then agents", () => {
    const merged = mergeSubRunCompletions(
      [{ value: "1 ", label: "1" }],
      [{ value: "w ", label: "worker" }],
      "",
    );
    assert.ok(Array.isArray(merged));
    assert.deepEqual(
      merged?.map((c) => c.label),
      ["1", "worker"],
    );
  });
});

// ━━━ decideMainContextWrap ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("decideMainContextWrap", () => {
  it("applies wrap when contextText is present", () => {
    const d = decideMainContextWrap({
      contextText: "ctx",
      totalMessageCount: 3,
      mainSessionFile: undefined,
    });
    assert.equal(d.apply, true);
    if (d.apply) {
      assert.equal(d.contextText, "ctx");
      assert.equal(d.totalMessageCount, 3);
      assert.equal(d.mainSessionFile, undefined);
    }
  });

  it("applies wrap when mainSessionFile is present even without contextText", () => {
    const d = decideMainContextWrap({
      contextText: "",
      totalMessageCount: 0,
      mainSessionFile: "/tmp/s.jsonl",
    });
    assert.equal(d.apply, true);
    if (d.apply) {
      assert.equal(d.mainSessionFile, "/tmp/s.jsonl");
    }
  });

  it("does NOT apply when neither context nor session file present", () => {
    const d = decideMainContextWrap({
      contextText: "",
      totalMessageCount: 0,
      mainSessionFile: undefined,
    });
    assert.equal(d.apply, false);
    if (!d.apply) {
      assert.equal(d.reason, "no-context");
    }
  });
});

// ━━━ sanitiseSessionFilePath ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("sanitiseSessionFilePath", () => {
  it("strips CR/LF/TAB and trims", () => {
    assert.equal(sanitiseSessionFilePath("  /tmp/a\n.jsonl  "), "/tmp/a.jsonl");
    assert.equal(sanitiseSessionFilePath("\t/tmp/b.jsonl\r"), "/tmp/b.jsonl");
  });
  it("returns undefined for empty/whitespace-only", () => {
    assert.equal(sanitiseSessionFilePath(""), undefined);
    assert.equal(sanitiseSessionFilePath("   "), undefined);
    assert.equal(sanitiseSessionFilePath("\n\r\t"), undefined);
  });
  it("returns undefined for non-string", () => {
    assert.equal(sanitiseSessionFilePath(undefined), undefined);
    assert.equal(sanitiseSessionFilePath(null), undefined);
  });
});

// ━━━ UX labels / constants ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("contextModeLabel", () => {
  it("renders main", () => assert.equal(contextModeLabel("main"), "main context"));
  it("renders isolated", () => assert.equal(contextModeLabel("isolated"), "dedicated sub-session"));
  it("renders undefined as isolated", () =>
    assert.equal(contextModeLabel(undefined), "dedicated sub-session"));
});

describe("startedStateLabel", () => {
  it("resumed when continuedFromRunId is a number", () =>
    assert.equal(startedStateLabel(5), "resumed"));
  it("started when undefined", () => assert.equal(startedStateLabel(undefined), "started"));
});

describe("formatAmbiguousAgentMessage", () => {
  it("includes usage text when requested", () => {
    const msg = formatAmbiguousAgentMessage(
      "re",
      [makeMockAgent({ name: "reviewer" }), makeMockAgent({ name: "reactor" })],
      true,
    );
    assert.ok(msg.includes(SUB_RUN_USAGE_TEXT));
    assert.ok(msg.includes('Ambiguous agent alias "re"'));
    assert.ok(msg.includes("reviewer, reactor"));
  });
  it("omits usage text when not requested", () => {
    const msg = formatAmbiguousAgentMessage(
      "re",
      [makeMockAgent({ name: "reviewer" }), makeMockAgent({ name: "reactor" })],
      false,
    );
    assert.equal(msg.includes("Usage:"), false);
    assert.ok(msg.includes("Use a longer alias or exact name."));
  });
});

describe("formatContinuationUnknownAgentMessage", () => {
  it("names both the run id and the previous agent", () => {
    const msg = formatContinuationUnknownAgentMessage(4, "ghost");
    assert.ok(msg.includes("Run #4"));
    assert.ok(msg.includes('unknown agent "ghost"'));
  });
});

describe("exported constants", () => {
  it("expose the usage text and warning strings", () => {
    assert.ok(SUB_RUN_USAGE_TEXT.startsWith("Usage:"));
    assert.ok(LEGACY_MAIN_PREFIX_WARNING.includes("--main"));
    assert.ok(NO_AGENTS_FOUND_MESSAGE.includes("No subagents found."));
  });
});
