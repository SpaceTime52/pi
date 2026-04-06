import type { Todo, TodoDetails, TodoState } from "./types.js";

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

export function reconstructState(
	entries: { type: string; message?: { role: string; toolName?: string; details?: unknown } }[],
): void {
	todos = [];
	nextId = 1;
	for (const entry of entries) {
		if (entry.type !== "message") continue;
		const msg = entry.message;
		if (!msg || msg.role !== "toolResult" || msg.toolName !== "todo") continue;
		const details = msg.details as TodoDetails | undefined;
		if (details) {
			todos = details.todos;
			nextId = details.nextId;
		}
	}
}
