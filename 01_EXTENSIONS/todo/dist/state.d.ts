import type { Todo, TodoEntry, TodoState } from "./types.js";
export declare function getState(): TodoState;
export declare function getTodos(): Todo[];
export declare function addTodo(text: string): Todo;
export declare function toggleTodo(id: number): Todo | undefined;
export declare function clearTodos(): number;
export declare function buildEntry(): TodoEntry;
export declare function restoreFromEntries(entries: {
    type: string;
    customType?: string;
    data?: unknown;
}[]): void;
