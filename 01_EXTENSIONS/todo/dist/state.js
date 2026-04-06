let todos = [];
let nextId = 1;
export function getState() {
    return { todos: [...todos], nextId };
}
export function getTodos() {
    return todos;
}
export function addTodo(text) {
    const todo = { id: nextId++, text, done: false };
    todos.push(todo);
    return todo;
}
export function toggleTodo(id) {
    const todo = todos.find((t) => t.id === id);
    if (todo)
        todo.done = !todo.done;
    return todo;
}
export function clearTodos() {
    const count = todos.length;
    todos = [];
    nextId = 1;
    return count;
}
export function reconstructState(entries) {
    todos = [];
    nextId = 1;
    for (const entry of entries) {
        if (entry.type !== "message")
            continue;
        const msg = entry.message;
        if (!msg || msg.role !== "toolResult" || msg.toolName !== "todo")
            continue;
        const details = msg.details;
        if (details) {
            todos = details.todos;
            nextId = details.nextId;
        }
    }
}
