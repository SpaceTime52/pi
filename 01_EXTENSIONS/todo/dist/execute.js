import { getState, addTodo, toggleTodo, clearTodos } from "./state.js";
import { formatSummary } from "./format.js";
function result(text, details) {
    return { content: [{ type: "text", text }], details };
}
function listAction() {
    return result(formatSummary(getState()), { action: "list", ...getState() });
}
function addAction(text) {
    if (!text) {
        return result("Error: text required", { action: "add", ...getState(), error: "text required" });
    }
    const todo = addTodo(text);
    return result(`Added #${todo.id}: ${todo.text}`, { action: "add", ...getState() });
}
function toggleAction(id) {
    if (id === undefined) {
        return result("Error: id required", { action: "toggle", ...getState(), error: "id required" });
    }
    const todo = toggleTodo(id);
    if (!todo) {
        return result(`#${id} not found`, { action: "toggle", ...getState(), error: `#${id} not found` });
    }
    return result(`#${todo.id} ${todo.done ? "completed" : "uncompleted"}`, { action: "toggle", ...getState() });
}
function clearAction() {
    const count = clearTodos();
    return result(`Cleared ${count} todos`, { action: "clear", ...getState() });
}
export function execute(params) {
    switch (params.action) {
        case "list": return listAction();
        case "add": return addAction(params.text);
        case "toggle": return toggleAction(params.id);
        case "clear": return clearAction();
        default:
            return result(`Unknown: ${params.action}`, {
                action: "list", ...getState(), error: `unknown: ${params.action}`,
            });
    }
}
