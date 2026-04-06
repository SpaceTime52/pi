import { describe, it, expect, beforeEach } from "vitest";
import { execute } from "../src/execute.js";
import { clearTodos } from "../src/state.js";

describe("execute", () => {
	beforeEach(() => {
		clearTodos();
	});

	it("list empty", () => {
		const r = execute({ action: "list" });
		expect(r.content[0].text).toBe("No todos");
		expect(r.details.action).toBe("list");
	});

	it("add", () => {
		const r = execute({ action: "add", text: "buy milk" });
		expect(r.content[0].text).toContain("#1");
		expect(r.details.todos).toHaveLength(1);
	});

	it("add without text", () => {
		const r = execute({ action: "add" });
		expect(r.details.error).toBe("text required");
	});

	it("list with done and undone", () => {
		execute({ action: "add", text: "a" });
		execute({ action: "add", text: "b" });
		execute({ action: "toggle", id: 1 });
		const r = execute({ action: "list" });
		expect(r.content[0].text).toContain("[x]");
		expect(r.content[0].text).toContain("[ ]");
	});

	it("toggle completed then uncompleted", () => {
		execute({ action: "add", text: "test" });
		const r1 = execute({ action: "toggle", id: 1 });
		expect(r1.content[0].text).toContain("completed");
		const r2 = execute({ action: "toggle", id: 1 });
		expect(r2.content[0].text).toContain("uncompleted");
	});

	it("toggle without id", () => {
		const r = execute({ action: "toggle" });
		expect(r.details.error).toBe("id required");
	});

	it("toggle missing id", () => {
		const r = execute({ action: "toggle", id: 999 });
		expect(r.details.error).toContain("not found");
	});

	it("clear", () => {
		execute({ action: "add", text: "a" });
		const r = execute({ action: "clear" });
		expect(r.content[0].text).toContain("Cleared 1");
		expect(r.details.todos).toEqual([]);
	});

	it("unknown action", () => {
		const r = execute({ action: "nope" });
		expect(r.details.error).toContain("unknown");
	});
});
