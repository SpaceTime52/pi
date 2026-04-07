import { describe, expect, it, vi } from "vitest";
import { proxyCall } from "../src/proxy-call.js";
import type { CallDeps } from "../src/proxy-call.js";
import type { McpContent } from "../src/types-server.js";

const mockContent: McpContent[] = [{ type: "text", text: "result" }];

function makeDeps(): CallDeps {
	return {
		findTool: vi.fn((name: string) =>
			name === "search"
				? { name: "search", originalName: "search", serverName: "gh", description: "d" }
				: undefined,
		),
		getAllMetadata: vi.fn(() => new Map()),
		getConfig: vi.fn(() => null),
		connectServer: vi.fn(async () => {}),
		getBackoffMs: vi.fn(() => 0),
		getFailure: vi.fn(() => undefined),
		getOrConnect: vi.fn(async () => ({
			name: "gh",
			client: {
				callTool: vi.fn(async () => ({ content: mockContent })),
				readResource: vi.fn(async () => ({ contents: [] })),
			},
			status: "connected" as const, lastUsedAt: 0, inFlight: 0,
		})),
		checkConsent: vi.fn(async () => true),
		transform: vi.fn((c: McpContent) => ({ type: "text" as const, text: c.text ?? "" })),
	};
}

describe("proxyCall", () => {
	it("calls tool and returns transformed content with details", async () => {
		const deps = makeDeps();
		const result = await proxyCall("search", { q: "test" }, deps);
		expect(deps.findTool).toHaveBeenCalledWith("search");
		expect(deps.checkConsent).toHaveBeenCalledWith("gh");
		expect(result.content).toEqual([{ type: "text", text: "result" }]);
		expect(result.details).toEqual({ mode: "call", server: "gh", tool: "search" });
	});

	it("passes arguments to callTool", async () => {
		const callTool = vi.fn(async () => ({ content: mockContent }));
		const deps = makeDeps();
		deps.getOrConnect = vi.fn(async () => ({
			name: "gh",
			client: { callTool, readResource: vi.fn(async () => ({ contents: [] })) },
			status: "connected" as const, lastUsedAt: 0, inFlight: 0,
		}));
		await proxyCall("search", { q: "hello" }, deps);
		expect(callTool).toHaveBeenCalledWith({ name: "search", arguments: { q: "hello" } });
	});

	it("returns details with error on not found", async () => {
		const deps = makeDeps();
		const result = await proxyCall("missing", {}, deps);
		expect(result.content[0].text).toContain("not found");
		expect(result.details).toEqual({ mode: "call", tool: "missing", error: "not_found" });
	});

	it("returns details with error on denied consent", async () => {
		const deps = makeDeps();
		deps.checkConsent = vi.fn(async () => false);
		const result = await proxyCall("search", {}, deps);
		expect(result.content[0].text).toContain("denied");
		expect(result.details).toEqual({ mode: "call", server: "gh", tool: "search", error: "denied" });
	});

	it("calls with undefined args when none provided", async () => {
		const result = await proxyCall("search", undefined, makeDeps());
		expect(result.content).toHaveLength(1);
	});

	it("handles multiple content blocks", async () => {
		const multi: McpContent[] = [{ type: "text", text: "a" }, { type: "text", text: "b" }];
		const deps = makeDeps();
		deps.getOrConnect = vi.fn(async () => ({
			name: "gh",
			client: {
				callTool: vi.fn(async () => ({ content: multi })),
				readResource: vi.fn(async () => ({ contents: [] })),
			},
			status: "connected" as const, lastUsedAt: 0, inFlight: 0,
		}));
		const result = await proxyCall("search", {}, deps);
		expect(result.content).toHaveLength(2);
	});
});
