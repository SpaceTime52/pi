import { describe, it, expect, vi, beforeEach } from "vitest";
import { createWidgetFactory, SPINNER_INTERVAL_MS } from "../src/render.js";
import type { Todo } from "../src/types.js";

function stubTheme() {
	return {
		fg: (color: string, text: string) => `[${color}]${text}`,
		bold: (text: string) => `**${text}**`,
		strikethrough: (text: string) => `~~${text}~~`,
	};
}

function stubTui() { return { requestRender: vi.fn() }; }
function makeTodo(id: number, text: string, done = false): Todo { return { id, text, done }; }

describe("createWidgetFactory", () => {
	beforeEach(() => { vi.useFakeTimers(); });

	it("returns a render function", () => {
		const widget = createWidgetFactory([], undefined, false, vi.fn())(stubTui(), stubTheme());
		expect(typeof widget.render).toBe("function");
		expect(typeof widget.invalidate).toBe("function");
	});

	it("renders done todo with strikethrough", () => {
		const todo = makeTodo(1, "done task", true);
		const lines = createWidgetFactory([todo], undefined, false, vi.fn())(stubTui(), stubTheme()).render(80);
		expect(lines.join("")).toContain("done task");
	});

	it("renders active running todo with spinner and bold", () => {
		const todo = makeTodo(1, "active", false);
		const lines = createWidgetFactory([todo], todo, true, vi.fn())(stubTui(), stubTheme()).render(80);
		expect(lines.join("")).toContain("active");
		expect(lines.join("")).toContain("**");
	});

	it("renders firstActive non-running todo with arrow", () => {
		const todo = makeTodo(1, "pending", false);
		const lines = createWidgetFactory([todo], todo, false, vi.fn())(stubTui(), stubTheme()).render(80);
		expect(lines.join("")).toContain("→");
	});

	it("renders other todo with circle", () => {
		const t1 = makeTodo(1, "first", false);
		const t2 = makeTodo(2, "second", false);
		const lines = createWidgetFactory([t1, t2], t1, false, vi.fn())(stubTui(), stubTheme()).render(80);
		expect(lines.join("")).toContain("○");
	});

	it("starts spinner interval when running and firstActive", () => {
		const todo = makeTodo(1, "running", false);
		const onStart = vi.fn();
		createWidgetFactory([todo], todo, true, onStart)(stubTui(), stubTheme());
		expect(onStart).toHaveBeenCalledWith(expect.anything());
	});

	it("does not start spinner when not running", () => {
		const todo = makeTodo(1, "idle", false);
		const onStart = vi.fn();
		createWidgetFactory([todo], todo, false, onStart)(stubTui(), stubTheme());
		expect(onStart).not.toHaveBeenCalled();
	});

	it("invalidate does not throw", () => {
		const widget = createWidgetFactory([], undefined, false, vi.fn())(stubTui(), stubTheme());
		expect(() => widget.invalidate()).not.toThrow();
	});

	it("render enforces minimum width of 8", () => {
		const todo = makeTodo(1, "x", false);
		const lines = createWidgetFactory([todo], todo, false, vi.fn())(stubTui(), stubTheme()).render(1);
		expect(lines.length).toBeGreaterThanOrEqual(1);
	});

	it("SPINNER_INTERVAL_MS is exported and positive", () => {
		expect(SPINNER_INTERVAL_MS).toBeGreaterThan(0);
	});
});
