import { describe, it, expect } from "vitest";
import { formatTodoLine, formatSummary, formatWidgetLines } from "../src/format.js";

describe("format", () => {
	it("formats undone line", () => {
		expect(formatTodoLine({ id: 1, text: "test", done: false })).toBe("[ ] #1: test");
	});

	it("formats done line", () => {
		expect(formatTodoLine({ id: 2, text: "done", done: true })).toBe("[x] #2: done");
	});

	it("formats empty summary", () => {
		expect(formatSummary({ todos: [], nextId: 1 })).toBe("No todos");
	});

	it("formats summary with items", () => {
		const summary = formatSummary({
			todos: [
				{ id: 1, text: "a", done: true },
				{ id: 2, text: "b", done: false },
			],
			nextId: 3,
		});
		expect(summary).toContain("1/2");
		expect(summary).toContain("[x]");
		expect(summary).toContain("[ ]");
	});

	it("formats empty widget", () => {
		expect(formatWidgetLines({ todos: [], nextId: 1 })).toEqual([]);
	});

	it("formats widget lines", () => {
		const lines = formatWidgetLines({
			todos: [
				{ id: 1, text: "a", done: false },
				{ id: 2, text: "b", done: true },
			],
			nextId: 3,
		});
		expect(lines[0]).toContain("○");
		expect(lines[1]).toContain("✓");
	});
});
