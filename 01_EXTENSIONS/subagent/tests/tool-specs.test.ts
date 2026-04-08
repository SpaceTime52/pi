import { describe, expect, it } from "vitest";
import { subagentToolSpecs } from "../src/tool-specs.js";

const getSpec = (name: string) => subagentToolSpecs.find((spec) => spec.name === name)!;

describe("subagent tool specs", () => {
	it("builds safe defaults for malformed batch and chain inputs", () => {
		expect(getSpec("subagent_batch").buildSubcommand({})).toEqual({ type: "batch", items: [], main: false });
		expect(getSpec("subagent_chain").buildSubcommand({})).toEqual({ type: "chain", steps: [], main: false });
	});

	it("builds control subcommands", () => {
		expect(getSpec("subagent_runs").buildSubcommand({})).toEqual({ type: "runs" });
		expect(getSpec("subagent_abort").buildSubcommand({ id: 4 })).toEqual({ type: "abort", id: 4 });
	});
});
