import { getState, getTodos, addTodo, toggleTodo, clearTodos } from "./state.js";
function textResult(text, details) {
    return { content: [{ type: "text", text }], details };
}
function listAction() {
    const todos = getTodos();
    const text = todos.length
        ? todos.map((t) => `[${t.done ? "x" : " "}] #${t.id}: ${t.text}`).join("\n")
        : "No todos";
    return textResult(text, { action: "list", ...getState() });
}
function addAction(text) {
    if (!text) {
        return textResult("Error: text required", { action: "add", ...getState(), error: "text required" });
    }
    const todo = addTodo(text);
    return textResult(`Added todo #${todo.id}: ${todo.text}`, { action: "add", ...getState() });
}
function toggleAction(id) {
    if (id === undefined) {
        return textResult("Error: id required", { action: "toggle", ...getState(), error: "id required" });
    }
    const todo = toggleTodo(id);
    if (!todo) {
        return textResult(`Todo #${id} not found`, {
            action: "toggle", ...getState(), error: `#${id} not found`,
        });
    }
    return textResult(`Todo #${todo.id} ${todo.done ? "completed" : "uncompleted"}`, { action: "toggle", ...getState() });
}
function clearAction() {
    const count = clearTodos();
    return textResult(`Cleared ${count} todos`, { action: "clear", ...getState() });
}
export function execute(params) {
    switch (params.action) {
        case "list": return listAction();
        case "add": return addAction(params.text);
        case "toggle": return toggleAction(params.id);
        case "clear": return clearAction();
        default:
            return textResult(`Unknown action: ${params.action}`, {
                action: "list", ...getState(), error: `unknown: ${params.action}`,
            });
    }
}
