import type { AgentToolResult, BashToolDetails, EditToolDetails } from "@mariozechner/pi-coding-agent";
import { describe, expect, it } from "vitest";
import { createClaudeBashTool } from "../src/bash-tool.ts";
import { createClaudeEditTool, renderDiffLine } from "../src/edit-tool.ts";
import { render, theme } from "./helpers.ts";

describe("bash and edit tool renderers", () => {
	it("renders bash calls and output states", () => {
		const bash = createClaudeBashTool(process.cwd());
		expect(render(bash.renderCall?.({ command: "echo hi", timeout: 1 }, theme)!)).toContain("echo hi");
		expect(render(bash.renderCall?.({ command: "x".repeat(100), timeout: 1 }, theme)!)).toContain("…");
		expect(render(bash.renderResult?.({ content: [] } as AgentToolResult<BashToolDetails | undefined>, { expanded: false, isPartial: true, showImages: false, isError: false }, theme)!)).toContain("running…");
		const ok = { content: [{ type: "text", text: "ok\nexit code: 0" }], details: { truncation: { truncated: true } } } as AgentToolResult<BashToolDetails | undefined>;
		expect(render(bash.renderResult?.(ok, { expanded: true, isPartial: false, showImages: false, isError: false }, theme)!)).toContain("truncated");
		const fail = { content: [{ type: "text", text: "bad\nexit code: 2" }], details: undefined } as AgentToolResult<BashToolDetails | undefined>;
		expect(render(bash.renderResult?.(fail, { expanded: false, isPartial: false, showImages: false, isError: true }, theme)!)).toContain("exit 2");
		expect(render(bash.renderResult?.({ content: [{ type: "image" }], details: undefined } as AgentToolResult<BashToolDetails | undefined>, { expanded: true, isPartial: false, showImages: false, isError: false }, theme)!)).toContain("done");
	});

	it("renders edit calls and diff states", () => {
		const edit = createClaudeEditTool(process.cwd());
		expect(renderDiffLine(theme, "+new")).toContain("toolDiffAdded");
		expect(renderDiffLine(theme, "-old")).toContain("toolDiffRemoved");
		expect(renderDiffLine(theme, " context")).toContain("toolDiffContext");
		expect(render(edit.renderCall?.({ path: "a.ts", edits: [] }, theme)!)).toContain("a.ts");
		expect(render(edit.renderResult?.({ content: [] } as AgentToolResult<EditToolDetails | undefined>, { expanded: false, isPartial: true, showImages: false, isError: false }, theme)!)).toContain("editing…");
		const error = { content: [{ type: "text", text: "Error: nope" }], details: undefined } as AgentToolResult<EditToolDetails | undefined>;
		expect(render(edit.renderResult?.(error, { expanded: false, isPartial: false, showImages: false, isError: true }, theme)!)).toContain("Error: nope");
		expect(render(edit.renderResult?.({ content: [], details: undefined } as AgentToolResult<EditToolDetails | undefined>, { expanded: false, isPartial: false, showImages: false, isError: false }, theme)!)).toContain("applied");
		const diff = { content: [{ type: "text", text: "note" }], details: { diff: `--- a\n+++ b\n context\n${"+x\n".repeat(25)}-old` } } as AgentToolResult<EditToolDetails | undefined>;
		expect(render(edit.renderResult?.(diff, { expanded: false, isPartial: false, showImages: false, isError: false }, theme)!)).toContain("+25");
		expect(render(edit.renderResult?.(diff, { expanded: true, isPartial: false, showImages: false, isError: false }, theme)!)).toContain("more diff lines");
	});
});
