import { Container, Text } from "@mariozechner/pi-tui";
import { describe, expect, it } from "vitest";
import { applyToolExecutionPatch, patchToolExecutionPrototype } from "../src/tool-execution-patch.ts";
import { render, theme } from "./helpers.ts";

describe("tool execution patch", () => {
	it("renders extension tools in a compact Claude style", async () => {
		class GenericToolExecution {
			toolName = "mcp"; args = { action: "call", tool: "fetch_content", server: "creatrip-internal" }; expanded = false; isPartial = false;
			result = { isError: false, details: { truncation: { truncated: true } } }; rendererState: { summary?: string } = {}; toolDefinition = {};
			getCallRenderer() { return undefined; } getResultRenderer() { return undefined; } getRenderShell() { return "default"; }
			createCallFallback() { return new Text("fallback", 0, 0); } createResultFallback() { return new Text("result", 0, 0); }
			getTextOutput() { return 'fetch https://www.google.com/search?q=x\n  prompt: "summarize it"\nsearch (383 chars)\n**페이지 정보**\nGoogle의 시스템이 비정상적인 트래픽을 감지했습니다.'; }
		}
		expect(patchToolExecutionPrototype()).toBe(false);
		expect(patchToolExecutionPrototype(GenericToolExecution.prototype)).toBe(false);
		expect(patchToolExecutionPrototype(GenericToolExecution.prototype, theme)).toBe(true);
		const collapsed = new GenericToolExecution();
		expect(collapsed.getRenderShell()).toBe("self");
		expect(collapsed.createResultFallback()).toBeInstanceOf(Container);
		const call = render(collapsed.createCallFallback() as { render(width: number): string[] });
		expect(call).toContain("MCP"); expect(call).toContain("Fetch Content"); expect(call).toContain("done"); expect(call).toContain("truncated");
		const expanded = new GenericToolExecution(); expanded.expanded = true;
		const preview = render(expanded.createResultFallback() as { render(width: number): string[] });
		expect(preview).toContain("└"); expect(preview).toContain("search · 383 chars"); expect(preview).toContain("페이지 정보 — Google의 시스템이"); expect(preview).not.toContain("prompt");
		expect(patchToolExecutionPrototype(GenericToolExecution.prototype, theme)).toBe(false);
		await applyToolExecutionPatch(async () => ({}));
		class LoadedExecution extends GenericToolExecution {}
		await applyToolExecutionPatch(async () => ({ ToolExecutionComponent: LoadedExecution, theme }));
		expect(new LoadedExecution().getRenderShell()).toBe("self");
	});

	it("suppresses custom renderer boxes for external tools", () => {
		class WebToolExecution {
			toolName = "web_search"; args = { query: "크리에이트립" }; expanded = false; isPartial = false; result = { isError: false, details: { totalResults: 5 } };
			rendererState: { summary?: string } = {}; toolDefinition = { renderCall: {}, renderResult: {} };
			getCallRenderer() { return "renderer"; } getResultRenderer() { return "renderer"; } getRenderShell() { return "default"; }
			createCallFallback() { return new Text("fallback", 0, 0); } createResultFallback() { return new Text("result", 0, 0); } getTextOutput() { return "공식 사이트\n앱 정보\n회사 정보"; }
		}
		expect(patchToolExecutionPrototype(WebToolExecution.prototype, theme)).toBe(true);
		const execution = new WebToolExecution();
		expect(execution.getCallRenderer()).toBeUndefined(); expect(execution.getResultRenderer()).toBeUndefined(); expect(execution.getRenderShell()).toBe("self");
		expect(render(execution.createCallFallback() as { render(width: number): string[] })).toContain("크리에이트립");
		execution.createResultFallback(); expect(execution.rendererState.summary).toContain("5 sources");
		class FetchTool extends WebToolExecution { toolName = "fetch_content"; result = { isError: false, details: { successful: 1, urlCount: 2 } }; getTextOutput() { return undefined; } }
		const fetch = new FetchTool(); expect(fetch.createResultFallback()).toBeInstanceOf(Container); expect(fetch.rendererState.summary).toContain("1/2 URLs");
		class ContentTool extends WebToolExecution { toolName = "get_search_content"; result = { isError: false, details: { totalChars: 451 } }; getTextOutput() { return undefined; } }
		const content = new ContentTool(); content.createResultFallback(); expect(content.rendererState.summary).toContain("451 chars");
	});

	it("handles empty args plus running and error states", () => {
		class RunningToolExecution {
			toolName = "status-check"; args = {}; expanded = true; isPartial = true; result = { isError: true, details: {} }; rendererState: { summary?: string } = {}; toolDefinition = {};
			getCallRenderer() { return undefined; } getResultRenderer() { return undefined; } getRenderShell() { return "default"; }
			createCallFallback() { return new Text("fallback", 0, 0); } createResultFallback() { return new Text("result", 0, 0); } getTextOutput() { return undefined; }
		}
		expect(patchToolExecutionPrototype(RunningToolExecution.prototype, theme)).toBe(true);
		const execution = new RunningToolExecution(); expect(render(execution.createCallFallback() as { render(width: number): string[] })).toContain("Status Check");
		expect(execution.createResultFallback()).toBeInstanceOf(Container); expect(execution.rendererState.summary).toContain("running…"); execution.isPartial = false;
		execution.createResultFallback(); expect(execution.rendererState.summary).toContain("error");
	});

	it("leaves built-in renderer overrides untouched", () => {
		class ExistingRenderers {
			toolName = "read"; args = {}; expanded = false; isPartial = false; rendererState = {}; toolDefinition = { renderCall: {} }; builtInToolDefinition = {};
			getCallRenderer() { return "renderer"; } getResultRenderer() { return "renderer"; } getRenderShell() { return "default"; }
			createCallFallback() { return new Text("fallback", 0, 0); } createResultFallback() { return new Text("result", 0, 0); } getTextOutput() { return ""; }
		}
		expect(patchToolExecutionPrototype(ExistingRenderers.prototype, theme)).toBe(true);
		const execution = new ExistingRenderers(); expect(execution.getCallRenderer()).toBe("renderer"); expect(execution.getResultRenderer()).toBe("renderer");
		expect(execution.getRenderShell()).toBe("default"); expect(render(execution.createCallFallback() as { render(width: number): string[] })).toContain("fallback");
		expect(render(execution.createResultFallback() as { render(width: number): string[] })).toContain("result");
	});
});
