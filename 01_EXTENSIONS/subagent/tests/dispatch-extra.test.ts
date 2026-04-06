import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AgentConfig, RunResult } from "../src/types.js";
import { resetStore, addRun } from "../src/store.js";
import { resetSession, addToHistory } from "../src/session.js";
vi.mock("fs", async (orig) => {
	const a = await orig<typeof import("fs")>();
	return { ...a, writeFileSync: vi.fn(), existsSync: vi.fn(() => true), mkdirSync: vi.fn() };
});
vi.mock("../src/spawn.js", () => ({ spawnAndCollect: vi.fn() }));
import { dispatchAbort, dispatchContinue } from "../src/dispatch.js";
import { spawnAndCollect } from "../src/spawn.js";
const agent: AgentConfig = { name: "scout", description: "", systemPrompt: "find", filePath: "/a.md" };
const ok: RunResult = { id: 1, agent: "scout", output: "done", usage: { inputTokens: 10, outputTokens: 5, turns: 1 } };
const mock = () => (spawnAndCollect as ReturnType<typeof vi.fn>);
const stubCtx = () => ({ hasUI: false, ui: { setWidget: vi.fn() }, sessionManager: { getBranch: () => [] } });
describe("dispatchAbort", () => {
	beforeEach(() => { vi.clearAllMocks(); resetStore(); resetSession(); });
	it("aborts an active run", () => {
		const abortFn = vi.fn();
		addRun({ id: 1, agent: "scout", startedAt: Date.now(), abort: abortFn });
		expect(dispatchAbort(1)).toContain("aborted");
		expect(abortFn).toHaveBeenCalled();
	});
	it("returns not found for missing run", () => {
		expect(dispatchAbort(999)).toContain("not found");
	});
});
describe("dispatchContinue", () => {
	beforeEach(() => { vi.clearAllMocks(); resetStore(); resetSession(); });
	it("continues an existing run", async () => {
		mock().mockResolvedValue(ok);
		addToHistory({ id: 1, agent: "scout", output: "ok", sessionFile: "/tmp/sess.json" });
		const result = await dispatchContinue(1, "more work", [agent], stubCtx());
		expect(typeof result).not.toBe("string");
		if (typeof result !== "string") expect(result.output).toBe("done");
	});
	it("returns not found when no history", async () => {
		expect(await dispatchContinue(999, "task", [agent], stubCtx())).toContain("not found");
	});
	it("returns agent not found when agent missing", async () => {
		addToHistory({ id: 1, agent: "unknown", output: "ok", sessionFile: "/tmp/s.json" });
		expect(await dispatchContinue(1, "task", [agent], stubCtx())).toContain("Agent for run");
	});
	it("throws on failure", async () => {
		mock().mockRejectedValue(new Error("fail"));
		addToHistory({ id: 1, agent: "scout", output: "ok", sessionFile: "/tmp/s.json" });
		await expect(dispatchContinue(1, "task", [agent], stubCtx())).rejects.toThrow("fail");
	});
	it("returns not found when session file missing", async () => {
		addToHistory({ id: 1, agent: "scout", output: "ok" });
		expect(await dispatchContinue(1, "task", [agent], stubCtx())).toContain("not found");
	});
});
