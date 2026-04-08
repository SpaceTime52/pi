import { describe, it, expect, vi } from "vitest";
vi.mock("../src/spawn.js", () => ({ spawnAndCollect: vi.fn() }));
import { createTool } from "../src/tool.js";

const stubPi = () => ({ appendEntry: vi.fn() });

describe("createTool renderCall/renderResult", () => {
	it("renderCall returns component", () => {
		const tool = createTool(stubPi(), "/nonexistent");
		const comp = tool.renderCall({ type: "run", agent: "scout", task: "hello" });
		expect(comp.render(80)).toBeInstanceOf(Array);
		expect(comp.render(80)[0]).toContain("scout");
	});

	it("renderResult returns component", () => {
		const tool = createTool(stubPi(), "/nonexistent");
		const comp = tool.renderResult({ content: [{ type: "text", text: "done" }] });
		expect(comp.render(80)).toEqual(["done"]);
	});
});
