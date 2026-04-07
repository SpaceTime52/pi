import { describe, it, expect, vi, beforeEach } from "vitest";
import { resetStore, addRun } from "../src/store.js";
import { resetSession, addToHistory } from "../src/session.js";

const agentMd = "---\nname: scout\ndescription: find code\n---\nYou find code.";
vi.mock("fs", async (orig) => {
	const a = await orig<typeof import("fs")>();
	return { ...a, writeFileSync: vi.fn(), existsSync: vi.fn((p: string) => String(p).includes("agents")), mkdirSync: vi.fn(), readdirSync: vi.fn(() => ["scout.md"]), readFileSync: vi.fn(() => agentMd) };
});
vi.mock("../src/spawn.js", () => ({ spawnAndCollect: vi.fn().mockResolvedValue({ id: 1, agent: "scout", output: "found", usage: { inputTokens: 10, outputTokens: 5, turns: 1 } }) }));

import { createTool } from "../src/tool.js";
import type { SubagentPi } from "../src/types.js";

const stubPi = (): SubagentPi => ({ appendEntry: vi.fn() });
const stubCtx = () => ({ hasUI: false, ui: { setWidget: vi.fn() }, sessionManager: { getBranch: (): unknown[] => [] } });
const exec = async (cmd: string) => createTool(stubPi(), "/agents").execute("", { command: cmd }, undefined, undefined, stubCtx());

describe("createTool commands", () => {
	beforeEach(() => { vi.clearAllMocks(); resetStore(); resetSession(); });

	it("handles invalid, run, batch, chain, and continue commands", async () => {
		expect((await exec("invalid")).details.isError).toBe(true);
		expect((await exec("run unknown -- task")).content[0].text).toContain("Unknown agent");
		expect((await exec("run scout -- find auth")).content[0].text).toContain("scout");
		expect((await exec("batch --agent scout --task find")).content[0].text).toContain("scout");
		expect((await exec("chain --agent scout --task find")).content[0].text).toContain("scout");
		expect((await exec("continue 999 -- more")).content[0].text).toContain("not found");
		addToHistory({ id: 1, agent: "scout", output: "ok", sessionFile: "/tmp/s.json" });
		expect((await exec("continue 1 -- more")).content[0].text).toContain("scout");
	});

	it("aborts active runs and reports missing ids", async () => {
		addRun({ id: 10, agent: "scout", startedAt: Date.now(), abort: vi.fn() });
		expect((await exec("abort 10")).content[0].text).toContain("aborted");
		expect((await exec("abort 999")).content[0].text).toContain("not found");
	});
});
