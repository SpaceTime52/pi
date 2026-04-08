import { describe, it, expect } from "vitest";
import { SubagentParams } from "../src/params.js";
import { Value } from "@sinclair/typebox/value";

describe("types", () => {
	it("SubagentParams validates structured run input", () => {
		expect(Value.Check(SubagentParams, { type: "run", agent: "scout", task: "find auth" })).toBe(true);
	});

	it("SubagentParams validates structured batch input", () => {
		expect(Value.Check(SubagentParams, { type: "batch", items: [{ agent: "reviewer", task: "Review auth changes" }] })).toBe(true);
	});

	it("SubagentParams rejects missing type", () => {
		expect(Value.Check(SubagentParams, {})).toBe(false);
	});

	it("SubagentParams rejects command-string input", () => {
		expect(Value.Check(SubagentParams, { command: "run scout -- find auth" })).toBe(false);
	});
});
