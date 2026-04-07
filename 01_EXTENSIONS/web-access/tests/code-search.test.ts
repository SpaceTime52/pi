import { describe, it, expect, vi } from "vitest";
import { codeSearch, isMissingCodeContextToolError, buildFallbackResult } from "../src/code-search.js";

describe("codeSearch", () => {
	it("calls Exa MCP with correct tool and params", async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			text: async () => JSON.stringify({
				result: { content: [{ type: "text", text: "function main() {}" }] },
			}),
		});
		const result = await codeSearch("react hooks", 3000, mockFetch);
		expect(result).toBe("function main() {}");
		const body = JSON.parse(mockFetch.mock.calls[0][1].body);
		expect(body.params.name).toBe("get_code_context_exa");
		expect(body.params.arguments.tokensNum).toBe(3000);
	});
	it("falls back to web search when the code context tool is unavailable", async () => {
		const mockFetch = vi
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				text: async () => JSON.stringify({
					error: { code: -32602, message: "Tool get_code_context_exa not found" },
				}),
			})
			.mockResolvedValueOnce({
				ok: true,
				text: async () => JSON.stringify({
					result: {
						content: [{
							type: "text",
							text: "Title: React Docs\nURL: https://react.dev\nText: useEffect example",
						}],
					},
				}),
			});
		const result = await codeSearch("react hooks", 3000, mockFetch);
		expect(result).toContain("useEffect example");
		expect(result).toContain("## Sources");
		const firstBody = JSON.parse(mockFetch.mock.calls[0][1].body);
		const secondBody = JSON.parse(mockFetch.mock.calls[1][1].body);
		expect(firstBody.params.name).toBe("get_code_context_exa");
		expect(secondBody.params.name).toBe("web_search_exa");
		expect(secondBody.params.arguments.query).toContain("react hooks");
	});
	it("passes signal through", async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			text: async () => '{"result":{"content":[{"type":"text","text":"ok"}]}}',
		});
		const controller = new AbortController();
		await codeSearch("q", 5000, mockFetch, controller.signal);
		expect(mockFetch.mock.calls[0][1].signal).toBe(controller.signal);
	});
});

describe("codeSearch helpers", () => {
	it("detects missing-tool errors from string values", () => {
		expect(isMissingCodeContextToolError("Tool get_code_context_exa not found")).toBe(true);
	});
	it("omits the sources heading when fallback results are empty", () => {
		expect(buildFallbackResult("answer", [])).toBe("answer");
	});
});
