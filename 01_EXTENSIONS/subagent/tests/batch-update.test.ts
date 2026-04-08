import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/store.js", () => ({ listRuns: vi.fn() }));

import { createBatchUpdate } from "../src/batch-update.js";
import { listRuns } from "../src/store.js";

const update = (id: number, text: string, activeRuns = [{ id, agent: `a${id}`, startedAt: id, depth: 1 }]) => ({
	content: [{ type: "text" as const, text }],
	details: { isError: false, activeRuns },
});

describe("createBatchUpdate", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns undefined when no update callback is provided", () => {
		expect(createBatchUpdate(undefined, 1)).toBeUndefined();
	});

	it("aggregates active runs and preserves finished summaries", () => {
		const onUpdate = vi.fn();
		const emit = createBatchUpdate(onUpdate, 3)!;
		(listRuns as ReturnType<typeof vi.fn>).mockReturnValue([{ id: 1 }, { id: 2 }]);
		emit(update(1, "⏳ scout #1 — first\ncurrent: running Bash"));
		(listRuns as ReturnType<typeof vi.fn>).mockReturnValue([{ id: 1 }, { id: 2 }]);
		emit(update(2, "⏳ worker #2 — second\ncurrent: reply ready"));
		const live = onUpdate.mock.calls.at(-1)?.[0]?.content?.[0]?.text ?? "";
		expect(live).toContain("2 active / 0 finished / 3 total");
		expect(live).toContain("active:");
		expect(live).toContain("  ⏳ scout #1");
		expect(live).toContain("  ⏳ worker #2");
		(listRuns as ReturnType<typeof vi.fn>).mockReturnValue([{ id: 2 }]);
		emit(update(2, "⏳ worker #2 — second\ncurrent: running Read"));
		const next = onUpdate.mock.calls.at(-1)?.[0]?.content?.[0]?.text ?? "";
		expect(next).toContain("1 active / 1 finished / 3 total");
		expect(next).toContain("active:");
		expect(next).toContain("current: running Read");
		expect(next).toContain("finished:");
		expect(next).toContain("✓ scout #1 — first");
	});

	it("passes through updates without a root run id", () => {
		const onUpdate = vi.fn();
		const emit = createBatchUpdate(onUpdate, 2)!;
		const orphan = { content: [{ type: "text" as const, text: "orphan" }], details: { isError: false, activeRuns: [] } };
		emit(orphan);
		expect(onUpdate).toHaveBeenCalledWith(orphan);
	});

	it("handles failed summaries and missing text blocks", () => {
		const onUpdate = vi.fn();
		const emit = createBatchUpdate(onUpdate, 2)!;
		(listRuns as ReturnType<typeof vi.fn>).mockReturnValue([{ id: 4 }]);
		emit({ content: [{ type: "json" as const }], details: { isError: false, activeRuns: [{ id: 4, agent: "a4", startedAt: 4, depth: 1 }] } });
		(listRuns as ReturnType<typeof vi.fn>).mockReturnValue([]);
		emit(update(4, "⏳ worker #4 — task\ncurrent: tool failed\n  ✗ bash: denied"));
		const text = onUpdate.mock.calls.at(-1)?.[0]?.content?.[0]?.text ?? "";
		expect(text).toContain("0 active / 1 finished / 2 total");
		expect(text).toContain("✗ worker #4 — task");
		expect(onUpdate.mock.calls.at(-1)?.[0]?.details.activeRuns).toEqual([]);
	});
});
