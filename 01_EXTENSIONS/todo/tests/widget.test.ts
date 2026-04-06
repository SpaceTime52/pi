import { describe, it, expect, beforeEach } from "vitest";
import { buildWidgetLines } from "../src/widget.js";
import { addTodo, clearTodos } from "../src/state.js";

describe("widget", () => {
	beforeEach(() => {
		clearTodos();
	});

	it("empty when no todos", () => {
		expect(buildWidgetLines()).toEqual([]);
	});

	it("returns lines for todos", () => {
		addTodo("task");
		const lines = buildWidgetLines();
		expect(lines).toHaveLength(1);
		expect(lines[0]).toContain("task");
	});
});
