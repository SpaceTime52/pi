import type { Todo, TodoState } from "./types.js";

export function formatTodoLine(t: Todo): string {
	return `[${t.done ? "x" : " "}] #${t.id}: ${t.text}`;
}

export function formatSummary(state: TodoState): string {
	if (state.todos.length === 0) return "No todos";
	const done = state.todos.filter((t) => t.done).length;
	const lines = [
		`Progress: ${done}/${state.todos.length}`,
		...state.todos.map(formatTodoLine),
	];
	return lines.join("\n");
}

export function formatWidgetLines(state: TodoState): string[] {
	if (state.todos.length === 0) return [];
	return state.todos.map((t) => {
		const marker = t.done ? "✓" : "○";
		return `${marker} #${t.id} ${t.text}`;
	});
}
