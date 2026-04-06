import { describe, it, expect, beforeEach } from "vitest";
import {
	getState, getTodos, addTodo, toggleTodo, clearTodos, reconstructState,
} from "../src/state.js";

describe("state", () => {
	beforeEach(() => {
		clearTodos();
	});

	it("starts empty", () => {
		expect(getTodos()).toEqual([]);
		expect(getState()).toEqual({ todos: [], nextId: 1 });
	});

	it("adds todos", () => {
		const todo = addTodo("test");
		expect(todo).toEqual({ id: 1, text: "test", done: false });
		expect(getTodos()).toHaveLength(1);
	});

	it("increments id", () => {
		addTodo("a");
		const b = addTodo("b");
		expect(b.id).toBe(2);
	});

	it("toggles todo", () => {
		addTodo("test");
		const toggled = toggleTodo(1);
		expect(toggled?.done).toBe(true);
		const again = toggleTodo(1);
		expect(again?.done).toBe(false);
	});

	it("returns undefined for missing toggle", () => {
		expect(toggleTodo(999)).toBeUndefined();
	});

	it("clears all", () => {
		addTodo("a");
		addTodo("b");
		const count = clearTodos();
		expect(count).toBe(2);
		expect(getTodos()).toEqual([]);
		expect(getState().nextId).toBe(1);
	});

	it("reconstructs from entries", () => {
		const entries = [
			{
				type: "message",
				message: {
					role: "toolResult",
					toolName: "todo",
					details: { todos: [{ id: 1, text: "saved", done: true }], nextId: 2 },
				},
			},
		];
		reconstructState(entries);
		expect(getTodos()).toEqual([{ id: 1, text: "saved", done: true }]);
		expect(getState().nextId).toBe(2);
	});

	it("skips non-todo entries", () => {
		const entries = [
			{ type: "message", message: { role: "assistant" } },
			{ type: "other" },
			{ type: "message", message: { role: "toolResult", toolName: "other" } },
		];
		reconstructState(entries);
		expect(getTodos()).toEqual([]);
	});
});
