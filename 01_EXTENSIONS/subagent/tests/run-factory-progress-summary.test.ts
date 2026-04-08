import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetStore } from "../src/store.js";
import { resetSession } from "../src/session.js";
import { resetWidgetState } from "../src/widget.js";
vi.mock("fs", async (orig) => ({ ...(await orig<typeof import("fs")>()), writeFileSync: vi.fn(), existsSync: vi.fn(() => true), mkdirSync: vi.fn() }));
vi.mock("../src/spawn.js", () => ({ spawnAndCollect: vi.fn() }));
import { createRunner } from "../src/run-factory.js";
import { agent, type EvtFn, makeCtx, mockSpawn, ok } from "./run-factory-test-helpers.ts";

describe("subagent progress summaries", () => {
	beforeEach(() => { vi.clearAllMocks(); resetStore(); resetSession(); resetWidgetState(); });

	it("summarizes nested subagent progress in current status", async () => {
		const onUpdate = vi.fn();
		mockSpawn().mockImplementation((_c, _a, _i, _n, _s, onEvt: EvtFn) => {
			onEvt({ type: "tool_update", toolName: "subagent_batch", text: "⏳ batch progress — 1 active / 1 finished / 2 total\n\nactive:\n  ⏳ worker #2 — task\n  current: running bash\n\nfinished:\n  ✓ worker #1 — done" });
			onEvt({ type: "tool_update", toolName: "subagent_run", text: "⏳ worker #3 — nested\ncurrent: drafting reply" });
			onEvt({ type: "tool_update", toolName: "subagent_run", text: "⏳ worker #3 — nested" });
			onEvt({ type: "tool_update", toolName: "subagent_run" });
			return Promise.resolve(ok);
		});
		await createRunner(false, makeCtx(), onUpdate)(agent, "inspect patch");
		expect(onUpdate.mock.calls[0]?.[0]?.content?.[0]?.text ?? "").toContain("current: subagent_batch: 1 active / 1 finished / 2 total");
		expect(onUpdate.mock.calls[1]?.[0]?.content?.[0]?.text ?? "").toContain("current: subagent_run: drafting reply");
		expect(onUpdate.mock.calls[2]?.[0]?.content?.[0]?.text ?? "").toContain("current: subagent_run: worker #3 — nested");
		expect(onUpdate.mock.calls[3]?.[0]?.content?.[0]?.text ?? "").toContain("current: subagent_run");
	});
});
