import { describe, expect, it, vi } from "vitest";
vi.mock("../src/spawn.js", () => ({ spawnAndCollect: vi.fn() }));
import { createTools } from "../src/tool.js";

const stubPi = () => ({ appendEntry: vi.fn() });
const getTool = (name: string) => createTools(stubPi(), "/nonexistent").find((tool) => tool.name === name)!;

describe("tool renderers", () => {
	it("renderCall returns component", () => {
		const comp = getTool("subagent_run").renderCall({ agent: "scout", task: "hello" });
		expect(comp.render(80)).toBeInstanceOf(Array);
		expect(comp.render(80)[0]).toContain("scout");
	});

	it("renderResult returns component", () => {
		const comp = getTool("subagent_run").renderResult({ content: [{ type: "text", text: "done" }] });
		expect(comp.render(80)).toEqual(["done"]);
	});
});
