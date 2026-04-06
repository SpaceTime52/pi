import { describe, it, expect, beforeEach } from "vitest";
import {
	getState, getTodos, addTodo, toggleTodo, clearTodos,
	restoreFromEntries, buildEntry,
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
		expect(toggleTodo(1)?.done).toBe(true);
		expect(toggleTodo(1)?.done).toBe(false);
	});

	it("returns undefined for missing toggle", () => {
		expect(toggleTodo(999)).toBeUndefined();
	});

	it("clears all", () => {
		addTodo("a");
		addTodo("b");
		expect(clearTodos()).toBe(2);
		expect(getTodos()).toEqual([]);
		expect(getState().nextId).toBe(1);
	});

	it("buildEntry snapshots current state", () => {
		addTodo("test");
		const entry = buildEntry();
		expect(entry.todos).toHaveLength(1);
		expect(entry.nextId).toBe(2);
		expect(entry.updatedAt).toBeGreaterThan(0);
	});

	it("restores from custom entries", () => {
		const entries = [
			{
				type: "custom",
				customType: "todo-state",
				data: { todos: [{ id: 1, text: "saved", done: true }], nextId: 2, updatedAt: 0 },
			},
		];
		restoreFromEntries(entries);
		expect(getTodos()).toEqual([{ id: 1, text: "saved", done: true }]);
		expect(getState().nextId).toBe(2);
	});

	it("takes last custom entry", () => {
		const entries = [
			{
				type: "custom",
				customType: "todo-state",
				data: { todos: [{ id: 1, text: "old", done: false }], nextId: 2, updatedAt: 0 },
			},
			{
				type: "custom",
				customType: "todo-state",
				data: { todos: [{ id: 1, text: "new", done: true }], nextId: 2, updatedAt: 1 },
			},
		];
		restoreFromEntries(entries);
		expect(getTodos()[0].text).toBe("new");
	});

	it("skips non-todo entries", () => {
		const entries = [
			{ type: "custom", customType: "other" },
			{ type: "message" },
		];
		restoreFromEntries(entries);
		expect(getTodos()).toEqual([]);
	});
});
