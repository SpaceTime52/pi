import { describe, expect, it } from "vitest";
import { Value } from "@sinclair/typebox/value";
import { BatchToolParams, RunToolParams, RunsToolParams } from "../src/params.js";

describe("subagent schemas", () => {
	it("validates run input", () => {
		expect(Value.Check(RunToolParams, { agent: "scout", task: "find auth" })).toBe(true);
	});

	it("validates batch input", () => {
		expect(Value.Check(BatchToolParams, { items: [{ agent: "reviewer", task: "Review auth changes" }] })).toBe(true);
	});

	it("validates empty runs input", () => {
		expect(Value.Check(RunsToolParams, {})).toBe(true);
	});

	it("rejects unexpected command fields", () => {
		expect(Value.Check(RunToolParams, { command: "run scout -- find auth" })).toBe(false);
	});
});
