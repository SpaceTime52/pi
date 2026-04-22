import type { AgentToolResult, ReadToolDetails } from "@mariozechner/pi-coding-agent";
import { describe, expect, it } from "vitest";
import { createClaudeReadTool } from "../src/read-tool.ts";
import { createClaudeWriteTool } from "../src/write-tool.ts";
import { render, theme } from "./helpers.ts";

describe("read and write tool renderers", () => {
	it("renders read calls and results", () => {
		const tool = createClaudeReadTool(process.cwd());
		expect(tool.renderShell).toBe("self");
		expect(render(tool.renderCall?.({ path: "a.ts" }, theme)!)).toContain("⏺");
		expect(render(tool.renderCall?.({ path: "a.ts" }, theme)!)).toContain("a.ts");
		expect(render(tool.renderResult?.({ content: [], details: undefined } as AgentToolResult<ReadToolDetails | undefined>, { expanded: false, isPartial: true, showImages: false, isError: false }, theme)!)).toContain("reading…");
		const textResult = { content: [{ type: "text", text: "a\nb\nc" }], details: { truncation: { truncated: true, totalLines: 9 } } } as AgentToolResult<ReadToolDetails | undefined>;
		expect(render(tool.renderResult?.(textResult, { expanded: true, isPartial: false, showImages: false, isError: false }, theme)!)).toContain("truncated from 9");
		expect(render(tool.renderResult?.({ content: [{ type: "image" }], details: undefined } as AgentToolResult<ReadToolDetails | undefined>, { expanded: false, isPartial: false, showImages: false, isError: false }, theme)!)).toContain("loaded");
	});

	it("renders write calls and partial, error, success states", () => {
		const tool = createClaudeWriteTool(process.cwd());
		expect(tool.renderShell).toBe("self");
		expect(render(tool.renderCall?.({ path: "a.ts", content: "a\nb" }, theme)!)).toContain("⏺");
		expect(render(tool.renderCall?.({ path: "a.ts", content: "a\nb" }, theme)!)).toContain("2 lines");
		expect(render(tool.renderResult?.({ content: [] } as AgentToolResult<undefined>, { expanded: false, isPartial: true, showImages: false, isError: false }, theme)!)).toContain("writing…");
		const errorResult = { content: [{ type: "text", text: "Error: nope" }] } as AgentToolResult<undefined>;
		expect(render(tool.renderResult?.(errorResult, { expanded: false, isPartial: false, showImages: false, isError: true }, theme)!)).toContain("Error: nope");
		const noteResult = { content: [{ type: "text", text: "note" }] } as AgentToolResult<undefined>;
		expect(render(tool.renderResult?.(noteResult, { expanded: false, isPartial: false, showImages: false, isError: false }, theme)!)).toContain("written");
		expect(render(tool.renderResult?.({ content: [] } as AgentToolResult<undefined>, { expanded: false, isPartial: false, showImages: false, isError: false }, theme)!)).toContain("written");
	});
});
