import { describe, it, expect, vi, beforeEach } from "vitest";
import { resetStore } from "../src/store.js";
import { resetSession } from "../src/session.js";

const agentMd = "---\nname: scout\ndescription: find code\n---\nYou find code.";
vi.mock("fs", async (orig) => {
	const a = await orig<typeof import("fs")>();
	return { ...a, writeFileSync: vi.fn(), existsSync: vi.fn((p: string) => String(p).includes("agents")), mkdirSync: vi.fn(), readdirSync: vi.fn(() => ["scout.md"]), readFileSync: vi.fn(() => agentMd) };
});
vi.mock("../src/spawn.js", () => ({ spawnAndCollect: vi.fn().mockResolvedValue({ id: 1, agent: "scout", output: "found", usage: { inputTokens: 10, outputTokens: 5, turns: 1 } }) }));

import { createTool, errorMsg } from "../src/tool.js";
import { spawnAndCollect } from "../src/spawn.js";
import type { SubagentPi, SubagentToolInput } from "../src/types.js";

const stubPi = (): SubagentPi => ({ appendEntry: vi.fn() });
const stubCtx = () => ({ hasUI: false, ui: { setWidget: vi.fn() }, sessionManager: { getBranch: (): unknown[] => [] } });
const exec = async (input: SubagentToolInput, signal?: AbortSignal) => createTool(stubPi(), "/agents").execute("", input, signal, undefined, stubCtx());

describe("createTool error handling", () => {
	beforeEach(() => { vi.clearAllMocks(); resetStore(); resetSession(); });

	it("returns aborted errors when the tool signal is canceled", async () => {
		(spawnAndCollect as ReturnType<typeof vi.fn>).mockImplementationOnce((_c: string, _a: string[], _i: number, _n: string, signal?: AbortSignal) => new Promise((_resolve, reject) => {
			signal?.addEventListener("abort", () => reject(new Error("Aborted")), { once: true });
		}));
		const ac = new AbortController();
		const pending = exec({ type: "run", agent: "scout", task: "find auth" }, ac.signal);
		ac.abort();
		const result = await pending;
		expect(result.content[0].text).toContain("Aborted");
		expect(result.details.isError).toBe(true);
	});

	it("formats unknown errors consistently", () => {
		expect(errorMsg(new Error("boom"))).toBe("boom");
		expect(errorMsg("oops")).toBe("oops");
		expect(errorMsg(42)).toBe("42");
	});
});
