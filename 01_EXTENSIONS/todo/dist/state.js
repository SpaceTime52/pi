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
export function buildEntry() {
    return { todos: [...todos], nextId, updatedAt: Date.now() };
}
export function restoreFromEntries(entries) {
    todos = [];
    nextId = 1;
    for (let i = entries.length - 1; i >= 0; i--) {
        const e = entries[i];
        if (e.type !== "custom" || e.customType !== "todo-state")
            continue;
        const data = e.data;
        if (data?.todos) {
            todos = data.todos;
            nextId = data.nextId;
            return;
        }
    }
}
