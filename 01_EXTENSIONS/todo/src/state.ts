import type { Todo, TodoEntry, TodoState } from "./types.js";

let todos: Todo[] = [];
let nextId = 1;

export function getState(): TodoState {
	return { todos: [...todos], nextId };
}

export function getTodos(): Todo[] {
	return todos;
}

export function addTodo(text: string): Todo {
	const todo: Todo = { id: nextId++, text, done: false };
	todos.push(todo);
	return todo;
}

export function toggleTodo(id: number): Todo | undefined {
	const todo = todos.find((t) => t.id === id);
	if (todo) todo.done = !todo.done;
	return todo;
}

export function clearTodos(): number {
	const count = todos.length;
	todos = [];
	nextId = 1;
	return count;
}

export function buildEntry(): TodoEntry {
	return { todos: [...todos], nextId, updatedAt: Date.now() };
}

export function restoreFromEntries(
	entries: { type: string; customType?: string; data?: unknown }[],
): void {
	todos = [];
	nextId = 1;
	for (let i = entries.length - 1; i >= 0; i--) {
		const e = entries[i];
		if (e.type !== "custom" || e.customType !== "todo-state") continue;
		const data = e.data as TodoEntry | undefined;
		if (data?.todos) {
			todos = data.todos;
			nextId = data.nextId;
			return;
		}
	}
}
