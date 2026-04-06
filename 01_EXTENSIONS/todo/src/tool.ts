import { StringEnum } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";
import { execute } from "./execute.js";

const TodoParams = Type.Object({
	action: StringEnum(["list", "add", "toggle", "clear"] as const),
	text: Type.Optional(Type.String({ description: "Todo text (for add)" })),
	id: Type.Optional(Type.Number({ description: "Todo ID (for toggle)" })),
});

export const todoTool = {
	name: "todo",
	label: "Todo",
	description: "Manage a todo list. Actions: list, add (text), toggle (id), clear",
	parameters: TodoParams,
	execute: (
		_toolCallId: string,
		params: { action: string; text?: string; id?: number },
	) => Promise.resolve(execute(params)),
};
