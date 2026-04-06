export interface Todo {
	id: number;
	text: string;
	done: boolean;
}

export interface TodoState {
	todos: Todo[];
	nextId: number;
}

export interface TodoDetails extends TodoState {
	action: string;
	error?: string;
}

export interface TodoEntry {
	todos: Todo[];
	nextId: number;
	updatedAt: number;
}
