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
import { existsSync } from "fs";
import type { SubagentPi } from "../src/types.js";

const stubPi = (): SubagentPi => ({ appendEntry: vi.fn() });
const stubCtx = () => ({ hasUI: false, ui: { setWidget: vi.fn() }, sessionManager: { getBranch: (): unknown[] => [] } });
const exec = async (input: { type: "runs" } | { type: "detail"; id: number }) => createTool(stubPi(), "/agents").execute("", input, undefined, undefined, stubCtx());

describe("createTool metadata and listings", () => {
	beforeEach(() => { vi.clearAllMocks(); resetStore(); resetSession(); });

	it("has correct metadata and loads without agent directories", () => {
		const tool = createTool(stubPi(), "/agents");
		expect(tool.name).toBe("subagent");
		expect(tool.label).toBe("Subagent");
		expect(tool.parameters).toBeDefined();
		expect(tool.description).toContain("subagent");
		(existsSync as ReturnType<typeof vi.fn>).mockReturnValueOnce(false);
		expect(createTool(stubPi(), "/no").name).toBe("subagent");
	});

	it("lists active runs, empty runs, and history", async () => {
		addRun({ id: 99, agent: "scout", startedAt: Date.now(), abort: () => {} });
		expect((await exec({ type: "runs" })).content[0].text).toContain("Active (1)");
		resetStore();
		expect((await exec({ type: "runs" })).content[0].text).toBe("No runs");
		addToHistory({ id: 1, agent: "scout", output: "found" });
		expect((await exec({ type: "runs" })).content[0].text).toContain("History (1)");
	});

	it("renders details for missing and existing history", async () => {
		expect((await exec({ type: "detail", id: 999 })).content[0].text).toContain("not found");
		addToHistory({ id: 5, agent: "scout", output: "result text" });
		expect((await exec({ type: "detail", id: 5 })).content[0].text).toContain("result text");
		addToHistory({ id: 6, agent: "scout" });
		expect((await exec({ type: "detail", id: 6 })).content[0].text).toContain("(no output)");
		addToHistory({ id: 7, agent: "scout", events: [{ type: "tool_start", toolName: "Bash" }, { type: "message", text: "found it" }] });
		expect((await exec({ type: "detail", id: 7 })).content[0].text).toContain("→ Bash");
		expect((await exec({ type: "runs" })).details.isError).toBe(false);
	});
});
