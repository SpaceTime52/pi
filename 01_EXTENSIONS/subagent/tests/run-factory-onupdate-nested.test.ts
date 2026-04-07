import { beforeEach, describe, expect, it, vi } from "vitest";
import { addRun, resetStore } from "../src/store.js";
import { resetSession } from "../src/session.js";
import { resetWidgetState } from "../src/widget.js";
vi.mock("fs", async (orig) => ({ ...(await orig<typeof import("fs")>()), writeFileSync: vi.fn(), existsSync: vi.fn(() => true), mkdirSync: vi.fn() }));
vi.mock("../src/spawn.js", () => ({ spawnAndCollect: vi.fn() }));
import { createRunner } from "../src/run-factory.js";
import { agent, type EvtFn, latestText, makeCtx, mockSpawn, ok } from "./run-factory-test-helpers.ts";

describe("onUpdate nested progress", () => {
	beforeEach(() => { vi.clearAllMocks(); resetStore(); resetSession(); resetWidgetState(); });

	it("retains recent progress lines across updates", async () => {
		const onUpdate = vi.fn();
		mockSpawn().mockImplementation((_c, _a, _i, _n, _s, onEvt: EvtFn) => { onEvt({ type: "tool_start", toolName: "Bash" }); onEvt({ type: "message", text: "output" }); return Promise.resolve(ok); });
		await createRunner(false, makeCtx(), onUpdate)(agent, "task");
		expect(onUpdate).toHaveBeenCalledTimes(2);
		expect(latestText(onUpdate)).toContain("→ Bash");
		expect(latestText(onUpdate)).toContain("💬 output");
		expect(onUpdate.mock.calls[1][0].details).toEqual(expect.objectContaining({ isError: false, activeRuns: expect.any(Array) }));
	});

	it("tracks nested subagent runs in progress updates and clears them on finish", async () => {
		const onUpdate = vi.fn();
		mockSpawn().mockImplementation((_c, _a, _i, _n, _s, onEvt: EvtFn) => { onEvt({ type: "tool_update", toolName: "subagent", text: "running", nestedRuns: [{ id: 2, agent: "worker", startedAt: 10, depth: 1 }] }); onEvt({ type: "tool_end", toolName: "subagent", isError: false, runTrees: [{ id: 2, agent: "worker", status: "ok" }] }); return Promise.resolve(ok); });
		await createRunner(false, makeCtx(), onUpdate)(agent, "task");
		expect(onUpdate.mock.calls[0][0].content[0].text).toContain("worker #2");
		expect(onUpdate.mock.calls[0][0].content[0].text).not.toContain("nested: ↳ scout #1");
		expect(onUpdate.mock.calls[0][0].details.activeRuns).toEqual([expect.objectContaining({ id: 1, agent: "scout", depth: 1 }), { id: 2, agent: "worker", startedAt: 10, depth: 2 }]);
		expect(onUpdate.mock.calls[1][0].content[0].text).not.toContain("nested:   ↳ worker #2");
		expect(onUpdate.mock.calls[1][0].content[0].text).toContain("nested └─✓ worker #2");
	});

	it("does not show sibling top-level runs as nested", async () => {
		const onUpdate = vi.fn();
		addRun({ id: 99, agent: "reviewer", task: "parallel review", startedAt: 5, abort: vi.fn() });
		mockSpawn().mockImplementation((_c, _a, _i, _n, _s, onEvt: EvtFn) => (onEvt({ type: "tool_start", toolName: "Bash" }), Promise.resolve(ok)));
		await createRunner(false, makeCtx(), onUpdate)(agent, "task");
		expect(latestText(onUpdate)).not.toContain("reviewer #99");
		expect(onUpdate.mock.calls[0][0].details.activeRuns).toEqual([expect.objectContaining({ id: 1, agent: "scout", depth: 1 })]);
	});

	it("shows all nested runs in progress text", async () => {
		const onUpdate = vi.fn();
		const nestedRuns = Array.from({ length: 6 }, (_, i) => ({ id: i + 2, agent: "worker", startedAt: 10 + i, depth: 1, task: i === 0 ? "review long diff" : undefined, activity: i === 1 ? "bash: npm test" : undefined }));
		mockSpawn().mockImplementation((_c, _a, _i, _n, _s, onEvt: EvtFn) => (onEvt({ type: "tool_update", toolName: "subagent", text: "running", nestedRuns }), Promise.resolve(ok)));
		await createRunner(false, makeCtx(), onUpdate)(agent, "task");
		expect(latestText(onUpdate)).toContain("worker #2 — review long diff");
		expect(latestText(onUpdate)).toContain("worker #3 → bash: npm test");
		expect(latestText(onUpdate)).toContain("worker #7");
		expect(latestText(onUpdate)).not.toContain("... +");
	});
});
