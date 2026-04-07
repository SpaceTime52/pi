import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AgentConfig, RunResult } from "../src/types.js";
import { resetStore, listRuns } from "../src/store.js";
import { resetSession } from "../src/session.js";

vi.mock("fs", async (orig) => {
	const a = await orig<typeof import("fs")>();
	return { ...a, writeFileSync: vi.fn(), existsSync: vi.fn(() => true), mkdirSync: vi.fn() };
});
vi.mock("../src/spawn.js", () => ({ spawnAndCollect: vi.fn() }));

import { createRunner } from "../src/run-factory.js";
import { spawnAndCollect } from "../src/spawn.js";
import { DEFAULT_HARD_TIMEOUT_MS, DEFAULT_IDLE_TIMEOUT_MS } from "../src/constants.js";

const agent: AgentConfig = { name: "scout", description: "", systemPrompt: "find", filePath: "/a.md" };
const ok: RunResult = { id: 1, agent: "scout", output: "found", usage: { inputTokens: 10, outputTokens: 5, turns: 1 } };
const mockSpawn = () => spawnAndCollect as ReturnType<typeof vi.fn>;
const ctx = () => ({ hasUI: false, ui: { setWidget: vi.fn() }, sessionManager: { getBranch: () => [] } });
const wait = (ms = 10) => new Promise((r) => setTimeout(r, ms));

describe("createRunner", () => {
	beforeEach(() => { vi.clearAllMocks(); resetStore(); resetSession(); });

	it("returns a function and records active runs", async () => {
		mockSpawn().mockImplementation(() => new Promise(() => {}));
		expect(typeof createRunner(false, ctx())).toBe("function");
		createRunner(false, ctx())(agent, "task");
		await wait();
		expect(listRuns()).toHaveLength(1);
		expect(() => listRuns()[0].abort()).not.toThrow();
	});

	it("passes signal and timeout options to spawnAndCollect", async () => {
		mockSpawn().mockResolvedValue(ok);
		await createRunner(false, ctx())(agent, "find");
		expect(mockSpawn().mock.calls[0][4] instanceof AbortSignal).toBe(true);
		expect(mockSpawn().mock.calls[0][6]).toEqual({ hardTimeoutMs: DEFAULT_HARD_TIMEOUT_MS, idleTimeoutMs: DEFAULT_IDLE_TIMEOUT_MS });
	});

	it("supports outer abort signals before and during a run", async () => {
		const outer = new AbortController();
		mockSpawn().mockImplementation((_c: string, _a: string[], _i: number, _n: string, signal?: AbortSignal) => new Promise((_resolve, reject) => {
			signal?.addEventListener("abort", () => reject(new Error("Aborted")), { once: true });
		}));
		const pending = createRunner(false, ctx(), undefined, outer.signal)(agent, "find");
		outer.abort();
		await expect(pending).rejects.toThrow("Aborted");
		const preAborted = new AbortController();
		preAborted.abort();
		mockSpawn().mockImplementationOnce((_c: string, _a: string[], _i: number, _n: string, signal?: AbortSignal) => Promise.reject(new Error(signal?.aborted ? "Aborted" : "Expected aborted signal")));
		await expect(createRunner(false, ctx(), undefined, preAborted.signal)(agent, "find")).rejects.toThrow("Aborted");
	});

	it("injects main context and creates missing session dirs", async () => {
		const fs = await import("fs");
		(fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((p: string) => !String(p).includes("sessions"));
		mockSpawn().mockResolvedValue(ok);
		const mainCtx = ctx();
		mainCtx.sessionManager.getBranch = () => [{ type: "message", message: { role: "user", content: [{ type: "text", text: "hello" }] } }];
		await createRunner(true, mainCtx)(agent, "find");
		expect((fs.writeFileSync as ReturnType<typeof vi.fn>).mock.calls[0][1]).toContain("[Main Context]");
		expect(fs.mkdirSync).toHaveBeenCalled();
	});

	it("returns results and clears failed runs", async () => {
		mockSpawn().mockResolvedValue(ok);
		expect((await createRunner(false, ctx())(agent, "find")).output).toBe("found");
		mockSpawn().mockRejectedValue(new Error("ENOENT"));
		await expect(createRunner(false, ctx())(agent, "fail")).rejects.toThrow();
		expect(listRuns()).toHaveLength(0);
	});
});
