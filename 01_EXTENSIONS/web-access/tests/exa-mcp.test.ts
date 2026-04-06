import { describe, it, expect, vi } from "vitest";
import { buildRpcBody, parseSseResponse, extractText, callExaMcp } from "../src/exa-mcp.js";

describe("buildRpcBody", () => {
	it("creates valid JSON-RPC body", () => {
		const body = JSON.parse(buildRpcBody("web_search_exa", { query: "test" }));
		expect(body.jsonrpc).toBe("2.0");
		expect(body.method).toBe("tools/call");
		expect(body.params.name).toBe("web_search_exa");
		expect(body.params.arguments.query).toBe("test");
	});
});

describe("parseSseResponse", () => {
	it("parses SSE data lines", () => {
		const sse = 'data: {"result":{"content":[{"type":"text","text":"hello"}]}}\n';
		const parsed = parseSseResponse(sse);
		expect(parsed?.result?.content?.[0]?.text).toBe("hello");
	});
	it("falls back to direct JSON", () => {
		const json = '{"result":{"content":[{"type":"text","text":"direct"}]}}';
		expect(parseSseResponse(json)?.result?.content?.[0]?.text).toBe("direct");
	});
	it("returns null for invalid input", () => {
		expect(parseSseResponse("garbage")).toBeNull();
	});
	it("skips empty data lines", () => {
		const sse = 'data: \ndata: {"result":{"content":[{"type":"text","text":"ok"}]}}\n';
		expect(parseSseResponse(sse)?.result?.content?.[0]?.text).toBe("ok");
	});
	it("skips non-data lines", () => {
		const sse = 'event: message\ndata: {"result":{"content":[{"type":"text","text":"ok"}]}}\n';
		expect(parseSseResponse(sse)?.result?.content?.[0]?.text).toBe("ok");
	});
	it("skips malformed JSON in data lines", () => {
		const sse = 'data: {bad json}\ndata: {"result":{"content":[{"type":"text","text":"ok"}]}}\n';
		expect(parseSseResponse(sse)?.result?.content?.[0]?.text).toBe("ok");
	});
});

describe("extractText", () => {
	it("extracts text from result", () => {
		expect(extractText({ result: { content: [{ type: "text", text: "hello" }] } })).toBe("hello");
	});
	it("throws on RPC error", () => {
		expect(() => extractText({ error: { code: 500, message: "fail" } })).toThrow("Exa MCP error 500: fail");
	});
	it("throws on RPC error without code", () => {
		expect(() => extractText({ error: { message: "fail" } })).toThrow("Exa MCP error: fail");
	});
	it("throws on isError result", () => {
		expect(() => extractText({ result: { isError: true, content: [{ type: "text", text: "bad" }] } })).toThrow("bad");
	});
	it("throws on isError with no message", () => {
		expect(() => extractText({ result: { isError: true } })).toThrow("Exa MCP returned an error");
	});
	it("throws on empty content", () => {
		expect(() => extractText({ result: { content: [] } })).toThrow("empty content");
	});
	it("throws on whitespace-only content", () => {
		expect(() => extractText({ result: { content: [{ type: "text", text: "   " }] } })).toThrow("empty content");
	});
});

describe("callExaMcp", () => {
	it("returns text on success", async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			text: async () => '{"result":{"content":[{"type":"text","text":"result"}]}}',
		});
		const text = await callExaMcp("tool", { q: "test" }, mockFetch);
		expect(text).toBe("result");
	});
	it("throws on HTTP error", async () => {
		const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "err" });
		await expect(callExaMcp("tool", {}, mockFetch)).rejects.toThrow("HTTP 500");
	});
	it("throws on empty response", async () => {
		const mockFetch = vi.fn().mockResolvedValue({ ok: true, text: async () => "not json at all" });
		await expect(callExaMcp("tool", {}, mockFetch)).rejects.toThrow("empty response");
	});
	it("passes signal to fetch", async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true, text: async () => '{"result":{"content":[{"type":"text","text":"ok"}]}}',
		});
		const controller = new AbortController();
		await callExaMcp("tool", {}, mockFetch, controller.signal);
		expect(mockFetch.mock.calls[0][1].signal).toBe(controller.signal);
	});
});
