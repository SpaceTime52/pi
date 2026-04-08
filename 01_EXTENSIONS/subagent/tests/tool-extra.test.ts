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

const stubPi = () => ({ appendEntry: vi.fn() });
const stubCtx = () => ({ hasUI: false, ui: { setWidget: vi.fn() }, sessionManager: { getBranch: (): unknown[] => [] } });
const exec = async (toolName: "subagent_runs" | "subagent_detail", input: unknown) => createTools(stubPi(), "/agents").find((tool) => tool.name === toolName)?.execute("", input, undefined, undefined, stubCtx());

describe("subagent listing tools", () => {
	beforeEach(() => { vi.clearAllMocks(); resetStore(); resetSession(); });

	it("includes task snippets and nested tree summaries in runs", async () => {
		addRun({ id: 1, agent: "scout", task: "find auth code in the repo", startedAt: Date.now(), abort: () => {} });
		addToHistory({ id: 2, agent: "scout", task: "review patch", error: "boom", runTrees: [{ id: 3, agent: "reviewer", status: "ok", children: [{ id: 4, agent: "verifier", status: "error", error: "bad" }] }] });
		const result = await exec("subagent_runs", {});
		expect(result?.content[0].text).toContain("find auth code in the repo");
		expect(result?.content[0].text).toContain("review patch");
		expect(result?.content[0].text).toContain("reviewer #3");
	});

	it("renders detailed history with task, session, error, and events", async () => {
		addToHistory({
			id: 7,
			agent: "scout",
			task: "investigate",
			sessionFile: "/tmp/subagent.json",
			error: "failed",
			output: "final output",
			runTrees: [{ id: 8, agent: "worker", status: "ok" }],
			events: [
				{ type: "tool_start", toolName: "Bash", text: "git status" },
				{ type: "tool_update", toolName: "Bash", text: "partial" },
				{ type: "tool_update", text: "orphan" },
				{ type: "tool_end", toolName: "Bash", text: "done", isError: true },
				{ type: "message_delta", text: "draft" },
				{ type: "message", text: "final message" },
				{ type: "agent_end", stopReason: "error" },
				{ type: "noop" },
			],
		});
		addToHistory({ id: 9, agent: "scout", events: [{ type: "tool_start", toolName: "Read" }, { type: "tool_update" }, { type: "tool_end", isError: false }] });
		const result = await exec("subagent_detail", { id: 7 });
		const fallback = await exec("subagent_detail", { id: 9 });
		expect(result?.content[0].text).toContain("session: /tmp/subagent.json");
		expect(result?.content[0].text).toContain("↳ Bash: partial");
		expect(result?.content[0].text).toContain("↳ tool: orphan");
		expect(result?.content[0].text).toContain("✗ Bash: done");
		expect(result?.content[0].text).toContain("… draft");
		expect(result?.content[0].text).toContain("done: error");
		expect(result?.content[0].text).toContain("worker #8");
		expect(fallback?.content[0].text).toContain("→ Read");
		expect(fallback?.content[0].text).toContain("✓ tool");
	});
});
