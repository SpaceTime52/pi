import { describe, it, expect } from "vitest";
import { visibleWidth } from "@mariozechner/pi-tui";
import { buildCallText, buildResultText, renderCall, renderResult } from "../src/render.js";

describe("buildCallText", () => {
	it("shows run command", () => {
		expect(buildCallText({ type: "run", agent: "scout", task: "find auth" })).toContain("scout");
	});

	it("shows batch count", () => {
		expect(buildCallText({ type: "batch", items: [{ agent: "w", task: "a" }, { agent: "r", task: "b" }] })).toContain("2");
	});

	it("shows chain steps", () => {
		expect(buildCallText({ type: "chain", steps: [{ agent: "s", task: "a" }, { agent: "w", task: "b" }] })).toContain("chain");
	});

	it("shows continue", () => {
		expect(buildCallText({ type: "continue", id: 3, task: "more work" })).toContain("#3");
	});

	it("shows detail", () => {
		expect(buildCallText({ type: "detail", id: 5 })).toContain("#5");
	});

	it("shows runs", () => {
		expect(buildCallText({ type: "runs" })).toContain("runs");
	});

	it("shows abort", () => {
		expect(buildCallText({ type: "abort", id: 5 })).toContain("#5");
	});

	it("falls back to JSON for invalid structured input", () => {
		expect(buildCallText(JSON.parse('{"type":"wat"}'))).toContain('"type":"wat"');
	});
});

describe("buildResultText", () => {
	it("formats success", () => {
		const text = buildResultText({ id: 1, agent: "scout", output: "found it", usage: { inputTokens: 100, outputTokens: 50, turns: 2 } });
		expect(text).toContain("scout #1");
		expect(text).toContain("found it");
	});

	it("formats error", () => {
		const text = buildResultText({ id: 1, agent: "worker", output: "", error: "crashed", usage: { inputTokens: 0, outputTokens: 0, turns: 0 } });
		expect(text).toContain("error");
		expect(text).toContain("crashed");
	});

	it("formats escalation with continue hint", () => {
		const text = buildResultText({ id: 1, agent: "worker", output: "", escalation: "delete file?", usage: { inputTokens: 0, outputTokens: 0, turns: 0 } });
		expect(text).toContain("needs your input");
		expect(text).toContain("delete file?");
		expect(text).toContain("subagent continue 1");
	});
});

describe("renderCall", () => {
	it("returns component with render method", () => {
		const comp = renderCall({ type: "run", agent: "scout", task: "find auth" });
		expect(comp.render(80)).toBeInstanceOf(Array);
		expect(comp.render(80)[0]).toContain("scout");
		comp.invalidate();
	});

	it("renders structured calls", () => {
		const comp = renderCall({ type: "run", agent: "reviewer", task: "Review auth changes" });
		expect(comp.render(80)[0]).toContain("reviewer");
	});

	it("truncates wide characters by visible width", () => {
		const comp = renderCall({ type: "run", agent: "challenger", task: "너는 가위바위보 선수 A다. 다른 선수의 선택은 모른다고 가정하고, 가위/바위/보 중 하나를 독립적으로 선택하라." });
		const line = comp.render(40)[0] ?? "";
		expect(visibleWidth(line)).toBeLessThanOrEqual(40);
	});
});

describe("renderResult", () => {
	it("returns component with render method", () => {
		const comp = renderResult({ content: [{ type: "text", text: "hello world" }] });
		expect(comp.render(80)).toEqual(["hello world"]);
	});
	it("handles multiline content", () => {
		const comp = renderResult({ content: [{ type: "text", text: "line1" }, { type: "text", text: "line2" }] });
		expect(comp.render(80)).toEqual(["line1", "line2"]);
	});
	it("truncates wide characters in results by visible width", () => {
		const comp = renderResult({ content: [{ type: "text", text: "가위바위보 가위바위보 가위바위보" }] });
		const line = comp.render(10)[0] ?? "";
		expect(visibleWidth(line)).toBeLessThanOrEqual(10);
	});
});
