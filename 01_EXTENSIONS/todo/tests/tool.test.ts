import { describe, it, expect } from "vitest";
import { todoTool } from "../src/tool.js";

describe("todoTool", () => {
	it("has correct name", () => {
		expect(todoTool.name).toBe("todo");
	});

	it("execute returns promise", async () => {
		const r = await todoTool.execute("", { action: "list" });
		expect(r.content[0].text).toBe("No todos");
	});
});
