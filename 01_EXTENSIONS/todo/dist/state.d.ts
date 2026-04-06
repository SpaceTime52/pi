import type { Todo, TodoState } from "./types.js";
export declare function getState(): TodoState;
export declare function getTodos(): Todo[];
export declare function addTodo(text: string): Todo;
export declare function toggleTodo(id: number): Todo | undefined;
export declare function clearTodos(): number;
export declare function reconstructState(entries: {
    type: string;
    message?: {
        role: string;
        toolName?: string;
        details?: unknown;
    };
}[]): void;
