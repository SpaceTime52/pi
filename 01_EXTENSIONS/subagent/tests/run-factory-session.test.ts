import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AgentConfig, RunResult } from "../src/types.js";
import { resetStore, listRuns } from "../src/store.js";
import { resetSession, getRunHistory } from "../src/session.js";

vi.mock("fs", async (orig) => {
	const a = await orig<typeof import("fs")>();
	return { ...a, writeFileSync: vi.fn(), existsSync: vi.fn(() => true), mkdirSync: vi.fn() };
});
vi.mock("../src/spawn.js", () => ({ spawnAndCollect: vi.fn() }));

import { createSessionRunner } from "../src/run-factory.js";
import { spawnAndCollect } from "../src/spawn.js";

const agent: AgentConfig = { name: "scout", description: "", systemPrompt: "find", filePath: "/a.md" };
const ok: RunResult = { id: 1, agent: "scout", output: "found", usage: { inputTokens: 10, outputTokens: 5, turns: 1 } };
const mockSpawn = () => spawnAndCollect as ReturnType<typeof vi.fn>;
const ctx = () => ({ hasUI: false, ui: { setWidget: vi.fn() }, sessionManager: { getBranch: () => [] } });
const wait = (ms = 10) => new Promise((r) => setTimeout(r, ms));

describe("createSessionRunner", () => {
	beforeEach(() => { vi.clearAllMocks(); resetStore(); resetSession(); });

	it("returns a function and uses existing sessions without prompt args", async () => {
		mockSpawn().mockResolvedValue(ok);
		expect(typeof createSessionRunner("/tmp/s.json", ctx())).toBe("function");
		await createSessionRunner("/tmp/sess.json", ctx())(agent, "continue task");
		const args = mockSpawn().mock.calls[0][1] as string[];
		expect(args).toContain("--session");
		expect(args).toContain("/tmp/sess.json");
		expect(args).not.toContain("--append-system-prompt");
	});

	it("passes signals and supports outer aborts", async () => {
		const outer = new AbortController();
		mockSpawn().mockImplementation((_c: string, _a: string[], _i: number, _n: string, signal?: AbortSignal) => new Promise((_resolve, reject) => {
			signal?.addEventListener("abort", () => reject(new Error("Aborted")), { once: true });
		}));
		const pending = createSessionRunner("/tmp/s.json", ctx(), undefined, outer.signal)(agent, "task");
		expect(mockSpawn().mock.calls[0][4] instanceof AbortSignal).toBe(true);
		outer.abort();
		await expect(pending).rejects.toThrow("Aborted");
	});

	it("cleans up runs and stores session history", async () => {
		mockSpawn().mockResolvedValue(ok);
		await createSessionRunner("/tmp/sess.json", ctx())(agent, "task");
		expect(listRuns()).toHaveLength(0);
		const hist = getRunHistory();
		expect(hist[hist.length - 1].sessionFile).toBe("/tmp/sess.json");
	});

	it("handles failures and preserves abort callbacks", async () => {
		mockSpawn().mockRejectedValueOnce(new Error("fail"));
		await expect(createSessionRunner("/tmp/s.json", ctx())(agent, "t")).rejects.toThrow();
		expect(listRuns()).toHaveLength(0);
		mockSpawn().mockImplementation(() => new Promise(() => {}));
		createSessionRunner("/tmp/s.json", ctx())(agent, "task");
		await wait();
		expect(() => listRuns()[0].abort()).not.toThrow();
	});
});
