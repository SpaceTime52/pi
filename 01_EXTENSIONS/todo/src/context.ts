import { getTodos, getState } from "./state.js";
import { formatSummary } from "./format.js";

export function buildTurnContext(): { content: string; display: boolean } | null {
	const todos = getTodos();
	if (todos.length === 0) return null;
	const summary = formatSummary(getState());
	const active = todos.find((t) => !t.done);
	const directive = active
		? `Active: #${active.id} ${active.text}`
		: "All items complete.";
	return {
		content: [
			"[todo-reminder] current todo state",
			summary,
			directive,
		].join("\n"),
		display: false,
	};
}

export function buildCompactionReminder(): string | null {
	const todos = getTodos();
	const remaining = todos.filter((t) => !t.done);
	if (remaining.length === 0) return null;
	return [
		"[todo-reminder] remaining items after compaction",
		formatSummary(getState()),
	].join("\n");
}
