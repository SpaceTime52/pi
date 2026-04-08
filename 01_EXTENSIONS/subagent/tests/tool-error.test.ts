import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetStore } from "../src/store.js";
import { resetSession } from "../src/session.js";

const agentMd = "---\nname: scout\ndescription: find code\n---\nYou find code.";
vi.mock("fs", async (orig) => {
	const fs = await orig<typeof import("fs")>();
	return { ...fs, writeFileSync: vi.fn(), existsSync: vi.fn((path: string) => String(path).includes("agents")), mkdirSync: vi.fn(), readdirSync: vi.fn(() => ["scout.md"]), readFileSync: vi.fn(() => agentMd) };
});
vi.mock("../src/spawn.js", () => ({ spawnAndCollect: vi.fn().mockResolvedValue({ id: 1, agent: "scout", output: "found", usage: { inputTokens: 10, outputTokens: 5, turns: 1 } }) }));

import { createTools, errorMsg } from "../src/tool.js";
import { spawnAndCollect } from "../src/spawn.js";
import type { SubagentPi } from "../src/types.js";

const stubPi = (): SubagentPi => ({ appendEntry: vi.fn() });
const stubCtx = () => ({ hasUI: false, ui: { setWidget: vi.fn() }, sessionManager: { getBranch: (): unknown[] => [] } });
const exec = async (signal?: AbortSignal) => createTools(stubPi(), "/agents").find((tool) => tool.name === "subagent_run")?.execute("", { agent: "scout", task: "find auth" }, signal, undefined, stubCtx());

describe("subagent tool errors", () => {
	beforeEach(() => { vi.clearAllMocks(); resetStore(); resetSession(); });

	it("returns aborted errors when the tool signal is canceled", async () => {
		vi.mocked(spawnAndCollect).mockImplementationOnce((_cmd, _args, _id, _name, signal) => new Promise((_resolve, reject) => { signal?.addEventListener("abort", () => reject(new Error("Aborted")), { once: true }); }));
		const controller = new AbortController();
		const pending = exec(controller.signal);
		controller.abort();
		expect((await pending)?.content[0].text).toContain("Aborted");
		expect((await exec())?.details.isError).toBe(false);
	});

	it("formats unknown errors consistently", () => {
		expect(errorMsg(new Error("boom"))).toBe("boom");
		expect(errorMsg("oops")).toBe("oops");
	});
});
