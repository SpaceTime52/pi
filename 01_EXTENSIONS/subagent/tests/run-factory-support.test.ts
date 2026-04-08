import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/run-progress.js", () => ({ unregisterRun: vi.fn() }));
vi.mock("../src/session.js", () => ({ addToHistory: vi.fn() }));
vi.mock("../src/store.js", () => ({ getRun: vi.fn() }));
vi.mock("../src/widget.js", () => ({ rememberCompletedRun: vi.fn() }));

import { finishRun, failRun } from "../src/run-factory-support.js";
import { unregisterRun } from "../src/run-progress.js";
import { addToHistory } from "../src/session.js";
import { getRun } from "../src/store.js";
import { rememberCompletedRun } from "../src/widget.js";

describe("run-factory-support completed widget handling", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(getRun as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
	});

	it("finishRun skips completed widget when active run is missing", () => {
		const result = { id: 1, agent: "worker", task: "fix auth", output: "done", usage: { inputTokens: 1, outputTokens: 1, turns: 1 }, escalation: "need answer" };
		expect(finishRun(result, "/tmp/run.json", [])).toBe(result);
		expect(rememberCompletedRun).not.toHaveBeenCalled();
		expect(addToHistory).toHaveBeenCalledWith(expect.objectContaining({ id: 1, agent: "worker", task: "fix auth", runTrees: undefined }));
		expect(unregisterRun).toHaveBeenCalledWith(1);
	});

	it("records escalation status when an active run exists", () => {
		(getRun as ReturnType<typeof vi.fn>).mockReturnValue({ startedAt: 123 });
		finishRun({ id: 3, agent: "scout", task: "ask user", output: "need answer", usage: { inputTokens: 1, outputTokens: 1, turns: 1 }, escalation: "need answer" }, "/tmp/run.json", []);
		expect(rememberCompletedRun).toHaveBeenCalledWith(expect.objectContaining({ id: 3, status: "escalation", summary: "need answer", startedAt: 123 }));
	});

	it("failRun skips completed widget when active run is missing", () => {
		expect(() => failRun("boom", 2, "reviewer", "review diff", "/tmp/run.json", [])).toThrow("boom");
		expect(rememberCompletedRun).not.toHaveBeenCalled();
		expect(addToHistory).toHaveBeenCalledWith(expect.objectContaining({ id: 2, agent: "reviewer", task: "review diff", error: "boom" }));
		expect(unregisterRun).toHaveBeenCalledWith(2);
	});
});
