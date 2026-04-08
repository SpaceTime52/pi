import { beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync } from "fs";
import { resetStore, addRun } from "../src/store.js";
import { resetSession, addToHistory } from "../src/session.js";

const agentMd = "---\nname: scout\ndescription: find code\n---\nYou find code.";
vi.mock("fs", async (orig) => {
	const fs = await orig<typeof import("fs")>();
	return { ...fs, writeFileSync: vi.fn(), existsSync: vi.fn((path: string) => String(path).includes("agents")), mkdirSync: vi.fn(), readdirSync: vi.fn(() => ["scout.md"]), readFileSync: vi.fn(() => agentMd) };
});
vi.mock("../src/spawn.js", () => ({ spawnAndCollect: vi.fn().mockResolvedValue({ id: 1, agent: "scout", output: "found", usage: { inputTokens: 10, outputTokens: 5, turns: 1 } }) }));

import { createAbortTool, createBatchTool, createChainTool, createContinueTool, createDetailTool, createRunTool, createRunsTool, createTools } from "../src/tool.js";
import type { SubagentPi } from "../src/types.js";

const stubPi = (): SubagentPi => ({ appendEntry: vi.fn() });
const stubCtx = () => ({ hasUI: false, ui: { setWidget: vi.fn() }, sessionManager: { getBranch: (): unknown[] => [] } });
const exec = async (toolName: string, input: unknown) => createTools(stubPi(), "/agents").find((tool) => tool.name === toolName)?.execute("", input, undefined, undefined, stubCtx());

describe("subagent tool metadata", () => {
	beforeEach(() => { vi.clearAllMocks(); resetStore(); resetSession(); });

	it("registers dedicated tools and loads without agent directories", () => {
		const tools = createTools(stubPi(), "/agents");
		expect(tools.map((tool) => tool.name)).toEqual(["subagent_run", "subagent_batch", "subagent_chain", "subagent_continue", "subagent_abort", "subagent_detail", "subagent_runs"]);
		expect(createRunTool(stubPi(), "/agents").name).toBe("subagent_run");
		expect(createBatchTool(stubPi(), "/agents").name).toBe("subagent_batch");
		expect(createChainTool(stubPi(), "/agents").name).toBe("subagent_chain");
		expect(createContinueTool(stubPi(), "/agents").name).toBe("subagent_continue");
		expect(createAbortTool(stubPi(), "/agents").name).toBe("subagent_abort");
		expect(createDetailTool(stubPi(), "/agents").name).toBe("subagent_detail");
		expect(createRunsTool(stubPi(), "/agents").name).toBe("subagent_runs");
		(existsSync as ReturnType<typeof vi.fn>).mockReturnValueOnce(false);
		expect(createTools(stubPi(), "/no")).toHaveLength(7);
	});

	it("lists active runs, empty runs, and history", async () => {
		addRun({ id: 99, agent: "scout", startedAt: Date.now(), abort: () => {} });
		expect((await exec("subagent_runs", {}))?.content[0].text).toContain("Active (1)");
		resetStore();
		expect((await exec("subagent_runs", {}))?.content[0].text).toBe("No runs");
		addToHistory({ id: 1, agent: "scout", output: "found" });
		expect((await exec("subagent_runs", {}))?.content[0].text).toContain("History (1)");
	});

	it("renders details for missing and existing history", async () => {
		expect((await exec("subagent_detail", { id: 999 }))?.content[0].text).toContain("not found");
		addToHistory({ id: 5, agent: "scout", output: "result text" });
		expect((await exec("subagent_detail", { id: 5 }))?.content[0].text).toContain("result text");
		addToHistory({ id: 6, agent: "scout" });
		expect((await exec("subagent_detail", { id: 6 }))?.content[0].text).toContain("(no output)");
	});
});
