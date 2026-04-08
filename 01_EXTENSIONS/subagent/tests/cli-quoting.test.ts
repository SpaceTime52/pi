import { describe, expect, it } from "vitest";
import { parseCommand } from "../src/cli.js";

describe("parseCommand quoting and edge cases", () => {
	it("parses quoted batch tasks", () => {
		expect(parseCommand("batch --agent worker --task 'Review current auth changes' --agent verifier --task 'Verify tests and types'"))
			.toEqual({ type: "batch", items: [{ agent: "worker", task: "Review current auth changes" }, { agent: "verifier", task: "Verify tests and types" }], main: false });
		expect(parseCommand('batch --agent reviewer --task "Review \\\"auth\\\" flow" --agent verifier --task "Verify\\ tests"'))
			.toEqual({ type: "batch", items: [{ agent: "reviewer", task: 'Review "auth" flow' }, { agent: "verifier", task: "Verify tests" }], main: false });
	});

	it("parses escaped spaces and empty quoted tasks", () => {
		expect(parseCommand("batch --agent review\\ er --task verify\\ tests")).toEqual({ type: "batch", items: [{ agent: "review er", task: "verify tests" }], main: false });
		expect(parseCommand('batch --agent reviewer --task ""')).toEqual({ type: "batch", items: [{ agent: "reviewer", task: "" }], main: false });
		expect(parseCommand("batch --agent reviewer --task ''")).toEqual({ type: "batch", items: [{ agent: "reviewer", task: "" }], main: false });
	});

	it("handles missing task values and repeated flags", () => {
		expect(parseCommand("batch --main")).toEqual({ type: "batch", items: [], main: true });
		expect(parseCommand("batch --main --agent w --task t")).toEqual({ type: "batch", items: [{ agent: "w", task: "t" }], main: true });
		expect(parseCommand("batch --agent a --agent b --task t1")).toEqual({ type: "batch", items: [{ agent: "a", task: "t1" }, { agent: "b", task: "" }], main: false });
		expect(parseCommand("batch --agent a --agent b --agent c")).toEqual({ type: "batch", items: [{ agent: "a", task: "" }, { agent: "b", task: "" }, { agent: "c", task: "" }], main: false });
	});

	it("throws on unterminated input", () => {
		expect(() => parseCommand("batch --agent reviewer --task 'Review auth")).toThrow("Unterminated single quote");
		expect(() => parseCommand("batch --agent reviewer --task broken\\")).toThrow("Unterminated escape sequence");
	});
});
