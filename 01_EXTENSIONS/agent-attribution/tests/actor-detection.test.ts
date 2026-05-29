import { describe, expect, it } from "vitest";
import { inferActorsFromSubagentCommand, inferActorsFromTool, unique } from "../src/actor-detection.js";

describe("agent attribution actor detection", () => {
	it("detects a single subagent run target", () => {
		expect(inferActorsFromSubagentCommand("subagent run worker -- implement the task")).toEqual(["worker"]);
		expect(inferActorsFromSubagentCommand('subagent run "worker" -- implement the task')).toEqual(["worker"]);
	});

	it("defaults subagent run without explicit target to worker", () => {
		expect(inferActorsFromSubagentCommand("subagent run --main -- implement the task")).toEqual(["worker"]);
	});

	it("detects batch agents from repeated flags", () => {
		expect(
			inferActorsFromSubagentCommand(
				'subagent batch --main --agent worker --task "A" --agent reviewer --task "B"',
			),
		).toEqual(["worker", "reviewer"]);
	});

	it("detects quoted agent names", () => {
		expect(inferActorsFromSubagentCommand('subagent batch --agent "fresh-reviewer" --task "A"')).toEqual([
			"fresh-reviewer",
		]);
		expect(inferActorsFromSubagentCommand("subagent batch --agent 'security-auditor' --task 'A'")).toEqual([
			"security-auditor",
		]);
	});

	it("ignores empty quoted agent names", () => {
		expect(inferActorsFromSubagentCommand('subagent batch --agent "" --task "A"')).toEqual([]);
	});

	it("ignores continuation run ids as agent names", () => {
		expect(inferActorsFromSubagentCommand("subagent continue 12 -- keep going")).toEqual([]);
	});

	it("returns an empty list for non-launch commands", () => {
		expect(inferActorsFromSubagentCommand("subagent help")).toEqual([]);
	});

	it("detects actors from subagent tool command args", () => {
		expect(inferActorsFromTool("subagent", { command: "subagent run verifier -- test it" })).toEqual(["verifier"]);
	});

	it("detects actors from structured subagent args", () => {
		expect(inferActorsFromTool("subagent", { agents: ["worker", "reviewer", " ", 7] })).toEqual([
			"worker",
			"reviewer",
		]);
		expect(inferActorsFromTool("subagent", { agent: "planner" })).toEqual(["planner"]);
		expect(inferActorsFromTool("subagent", undefined)).toEqual([]);
	});

	it("detects actors from Agent tool args", () => {
		expect(inferActorsFromTool("Agent", { subagent_type: "browser" })).toEqual(["browser"]);
		expect(inferActorsFromTool("Agent", null)).toEqual([]);
	});

	it("labels TaskExecute as task agents", () => {
		expect(inferActorsFromTool("TaskExecute", { task_ids: ["1"] })).toEqual(["task agents"]);
		expect(inferActorsFromTool("task_execute", { task_ids: ["1"] })).toEqual(["task agents"]);
	});

	it("returns an empty list for unrelated tools", () => {
		expect(inferActorsFromTool("bash", { command: "echo ok" })).toEqual([]);
	});

	it("deduplicates actor names", () => {
		expect(unique(["worker", "worker", " reviewer ", ""])).toEqual(["worker", "reviewer"]);
	});
});
