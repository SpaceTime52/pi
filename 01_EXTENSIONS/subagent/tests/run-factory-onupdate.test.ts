import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetStore } from "../src/store.js";
import { resetSession } from "../src/session.js";
import { resetWidgetState } from "../src/widget.js";
vi.mock("fs", async (orig) => ({ ...(await orig<typeof import("fs")>()), writeFileSync: vi.fn(), existsSync: vi.fn(() => true), mkdirSync: vi.fn() }));
vi.mock("../src/spawn.js", () => ({ spawnAndCollect: vi.fn() }));
import { createRunner, createSessionRunner } from "../src/run-factory.js";
import { agent, type EvtFn, latestText, makeCtx, mockSpawn, ok } from "./run-factory-test-helpers.ts";

describe("onUpdate callback", () => {
	beforeEach(() => { vi.clearAllMocks(); resetStore(); resetSession(); resetWidgetState(); });

	it("includes run header and tool progress in createRunner", async () => {
		const onUpdate = vi.fn();
		mockSpawn().mockImplementation((_c, _a, _i, _n, _s, onEvt: EvtFn) => (onEvt({ type: "tool_start", toolName: "Bash" }), Promise.resolve(ok)));
		await createRunner(false, makeCtx(), onUpdate)(agent, "task");
		expect(latestText(onUpdate)).toContain("⏳ scout #1 — task");
		expect(latestText(onUpdate)).toContain("current: running Bash");
		expect(latestText(onUpdate)).toContain("→ Bash");
		expect(onUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ details: expect.objectContaining({ isError: false, activeRuns: expect.any(Array) }) }));
	});

	it("includes reply status for message event in createRunner", async () => {
		const onUpdate = vi.fn();
		mockSpawn().mockImplementation((_c, _a, _i, _n, _s, onEvt: EvtFn) => (onEvt({ type: "message", text: "progress update" }), Promise.resolve(ok)));
		await createRunner(false, makeCtx(), onUpdate)(agent, "task");
		expect(latestText(onUpdate)).toContain("reply ready");
		expect(latestText(onUpdate)).toContain("💬 progress update");
	});

	it("includes run header and tool progress in createSessionRunner", async () => {
		const onUpdate = vi.fn();
		mockSpawn().mockImplementation((_c, _a, _i, _n, _s, onEvt: EvtFn) => (onEvt({ type: "tool_start", toolName: "Write" }), Promise.resolve(ok)));
		await createSessionRunner("/tmp/s.json", makeCtx(), onUpdate)(agent, "task");
		expect(latestText(onUpdate)).toContain("⏳ scout #1 — task");
		expect(latestText(onUpdate)).toContain("current: running Write");
		expect(latestText(onUpdate)).toContain("→ Write");
	});

	it("includes reply status for message in createSessionRunner", async () => {
		const onUpdate = vi.fn();
		mockSpawn().mockImplementation((_c, _a, _i, _n, _s, onEvt: EvtFn) => (onEvt({ type: "message", text: "session message" }), Promise.resolve(ok)));
		await createSessionRunner("/tmp/s.json", makeCtx(), onUpdate)(agent, "task");
		expect(latestText(onUpdate)).toContain("reply ready");
		expect(latestText(onUpdate)).toContain("💬 session message");
	});

	it("uses generic tool label when toolName is undefined", async () => {
		const onUpdate = vi.fn();
		mockSpawn().mockImplementation((_c, _a, _i, _n, _s, onEvt: EvtFn) => (onEvt({ type: "tool_start", toolName: undefined }), Promise.resolve(ok)));
		await createRunner(false, makeCtx(), onUpdate)(agent, "task");
		expect(latestText(onUpdate)).toContain("current: running tool");
		expect(latestText(onUpdate)).toContain("→ tool");
	});
});
