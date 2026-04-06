import { describe, it, expect, vi } from "vitest";
import { buildWidgetLines, syncWidget } from "../src/widget.js";

describe("buildWidgetLines", () => {
	it("shows running agents", () => {
		const runs = [
			{ id: 1, agent: "scout", startedAt: Date.now() - 5000 },
			{ id: 2, agent: "worker", startedAt: Date.now() - 10000 },
		];
		const lines = buildWidgetLines(runs, Date.now());
		expect(lines).toHaveLength(2);
		expect(lines[0]).toContain("scout");
		expect(lines[0]).toContain("#1");
	});

	it("returns empty for no runs", () => {
		expect(buildWidgetLines([], Date.now())).toEqual([]);
	});

	it("limits to 3 visible", () => {
		const runs = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, agent: "w", startedAt: 0 }));
		expect(buildWidgetLines(runs, Date.now())).toHaveLength(3);
	});
});

describe("syncWidget", () => {
	it("sets widget when runs exist", () => {
		const setWidget = vi.fn();
		const ctx = { hasUI: true, ui: { setWidget } };
		syncWidget(ctx, [{ id: 1, agent: "scout", startedAt: Date.now() }]);
		expect(setWidget).toHaveBeenCalledWith("subagent-status", expect.any(Array), { placement: "belowEditor" });
	});

	it("clears widget when no runs", () => {
		const setWidget = vi.fn();
		syncWidget({ hasUI: true, ui: { setWidget } }, []);
		expect(setWidget).toHaveBeenCalledWith("subagent-status", undefined);
	});

	it("skips when no UI", () => {
		const setWidget = vi.fn();
		syncWidget({ hasUI: false, ui: { setWidget } }, [{ id: 1, agent: "w", startedAt: 0 }]);
		expect(setWidget).not.toHaveBeenCalled();
	});
});
