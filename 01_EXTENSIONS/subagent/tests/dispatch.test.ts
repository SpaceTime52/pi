import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AgentConfig, RunResult } from "../src/types.js";
import { resetStore } from "../src/store.js";
import { resetSession } from "../src/session.js";
vi.mock("fs", async (orig) => {
	const a = await orig<typeof import("fs")>();
	return { ...a, writeFileSync: vi.fn(), existsSync: vi.fn(() => true), mkdirSync: vi.fn() };
});
vi.mock("../src/spawn.js", () => ({ spawnAndCollect: vi.fn() }));
import { dispatchRun, dispatchBatch, dispatchChain, onSessionRestore } from "../src/dispatch.js";
import { spawnAndCollect } from "../src/spawn.js";
const agent: AgentConfig = { name: "scout", description: "", systemPrompt: "find", filePath: "/a.md" };
const ok: RunResult = { id: 1, agent: "scout", output: "found", usage: { inputTokens: 10, outputTokens: 5, turns: 1 } };
const mock = () => (spawnAndCollect as ReturnType<typeof vi.fn>);
const stubCtx = () => ({ hasUI: false, ui: { setWidget: vi.fn() }, sessionManager: { getBranch: () => [] } });
describe("dispatchRun", () => {
	beforeEach(() => { vi.clearAllMocks(); resetStore(); resetSession(); });
	it("returns RunResult directly", async () => {
		mock().mockResolvedValue(ok);
		const result = await dispatchRun(agent, "find", stubCtx(), false);
		expect(result.output).toBe("found");
	});
	it("throws on failure", async () => {
		mock().mockRejectedValue(new Error("crash"));
		await expect(dispatchRun(agent, "find", stubCtx(), false)).rejects.toThrow("crash");
	});
});
describe("dispatchBatch", () => {
	beforeEach(() => { vi.clearAllMocks(); resetStore(); resetSession(); });
	it("returns array of results", async () => {
		mock().mockResolvedValue(ok);
		const results = await dispatchBatch([{ agent: "scout", task: "a" }], [agent], stubCtx(), false);
		expect(results).toHaveLength(1);
		expect(results[0].output).toBe("found");
	});
});
describe("dispatchChain", () => {
	beforeEach(() => { vi.clearAllMocks(); resetStore(); resetSession(); });
	it("returns final result", async () => {
		mock().mockResolvedValue(ok);
		const result = await dispatchChain([{ agent: "scout", task: "a" }], [agent], stubCtx(), false);
		expect(result.output).toBe("found");
	});
});
describe("onSessionRestore", () => {
	it("returns handler that restores and syncs", async () => {
		const handler = onSessionRestore();
		const ctx = { ...stubCtx(), hasUI: true };
		await handler(undefined, ctx);
		expect(ctx.ui.setWidget).toHaveBeenCalled();
	});
});
