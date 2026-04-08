import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetStore, addRun } from "../src/store.js";
import { resetSession, addToHistory } from "../src/session.js";

const agentMd = "---\nname: scout\ndescription: find code\n---\nYou find code.";
vi.mock("fs", async (orig) => {
	const fs = await orig<typeof import("fs")>();
	return { ...fs, writeFileSync: vi.fn(), existsSync: vi.fn((path: string) => String(path).includes("agents")), mkdirSync: vi.fn(), readdirSync: vi.fn(() => ["scout.md"]), readFileSync: vi.fn(() => agentMd) };
});
vi.mock("../src/spawn.js", () => ({ spawnAndCollect: vi.fn().mockResolvedValue({ id: 1, agent: "scout", output: "found", usage: { inputTokens: 10, outputTokens: 5, turns: 1 } }) }));

import { createTools } from "../src/tool.js";
import type { SubagentPi } from "../src/types.js";

const stubPi = (): SubagentPi => ({ appendEntry: vi.fn() });
const stubCtx = () => ({ hasUI: false, ui: { setWidget: vi.fn() }, sessionManager: { getBranch: (): unknown[] => [] } });
const exec = async (toolName: string, input: unknown) => createTools(stubPi(), "/agents").find((tool) => tool.name === toolName)?.execute("", input, undefined, undefined, stubCtx());

describe("subagent command tools", () => {
	beforeEach(() => { vi.clearAllMocks(); resetStore(); resetSession(); });

	it("handles run, batch, chain, and continue", async () => {
		expect((await exec("subagent_run", { agent: "unknown", task: "task" }))?.details.isError).toBe(true);
		expect((await exec("subagent_run", { agent: "scout", task: "find auth" }))?.content[0].text).toContain("scout");
		expect((await exec("subagent_batch", { items: [{ agent: "scout", task: "find" }] }))?.content[0].text).toContain("scout");
		expect((await exec("subagent_chain", { steps: [{ agent: "scout", task: "find" }] }))?.content[0].text).toContain("scout");
		expect((await exec("subagent_continue", { id: 999, task: "more" }))?.content[0].text).toContain("not found");
		addToHistory({ id: 1, agent: "scout", output: "ok", sessionFile: "/tmp/s.json" });
		expect((await exec("subagent_continue", { id: 1, task: "more" }))?.content[0].text).toContain("scout");
	});

	it("handles abort ids", async () => {
		addRun({ id: 10, agent: "scout", startedAt: Date.now(), abort: vi.fn() });
		expect((await exec("subagent_abort", { id: 10 }))?.content[0].text).toContain("aborted");
		expect((await exec("subagent_abort", { id: 999 }))?.content[0].text).toContain("not found");
	});
});
