import { describe, expect, it } from "vitest";
import { formatActorList, getPlainStatusText, MAIN_AGENT } from "../src/format.js";

describe("agent attribution formatting", () => {
	it("formats idle main state", () => {
		expect(getPlainStatusText({ phase: "idle", actor: MAIN_AGENT, contributors: [MAIN_AGENT] })).toBe(
			"agent: main assistant · idle",
		);
	});

	it("formats delegated state", () => {
		expect(
			getPlainStatusText({
				phase: "delegating",
				actor: "worker",
				detail: "from main assistant",
				contributors: [MAIN_AGENT, "worker"],
			}),
		).toBe("agent: worker · from main assistant");
	});

	it("formats done state with contributors", () => {
		expect(getPlainStatusText({ phase: "done", actor: MAIN_AGENT, contributors: [MAIN_AGENT, "worker"] })).toBe(
			"✓ agent: main assistant · done · via worker",
		);
	});

	it("formats working state", () => {
		expect(getPlainStatusText({ phase: "working", actor: MAIN_AGENT, contributors: [MAIN_AGENT] })).toBe(
			"agent: main assistant · preparing",
		);
	});

	it("formats tool state", () => {
		expect(
			getPlainStatusText({
				phase: "using-tool",
				actor: MAIN_AGENT,
				detail: "using bash",
				contributors: [MAIN_AGENT],
			}),
		).toBe("agent: main assistant · using bash");
	});

	it("formats delegated state without detail", () => {
		expect(getPlainStatusText({ phase: "delegating", actor: "worker", contributors: [MAIN_AGENT, "worker"] })).toBe(
			"agent: worker · delegated",
		);
	});

	it("summarizes actor lists", () => {
		expect(formatActorList(["worker", "reviewer"])).toBe("worker, reviewer");
		expect(formatActorList(["worker", "reviewer", "verifier"])).toBe("worker, reviewer +1");
	});
});
