import { describe, expect, it, vi } from "vitest";
import { resolveTool, isResolveError } from "../src/proxy-resolve.js";
import type { ResolveDeps } from "../src/proxy-resolve.js";

const tool = (name: string, server: string) => ({
	name, originalName: name, serverName: server, description: "d",
});

function makeDeps(overrides?: Partial<ResolveDeps>): ResolveDeps {
	return {
		findTool: vi.fn(() => undefined),
		getAllMetadata: vi.fn(() => new Map()),
		getConfig: vi.fn(() => null),
		connectServer: vi.fn(async () => {}),
		getBackoffMs: vi.fn(() => 0),
		getFailure: vi.fn(() => undefined),
		...overrides,
	};
}

describe("resolveTool", () => {
	it("returns exact match from findTool", async () => {
		const meta = tool("search", "gh");
		const deps = makeDeps({ findTool: vi.fn(() => meta) });
		const r = await resolveTool("search", deps);
		expect(isResolveError(r)).toBe(false);
		if (!isResolveError(r)) {
			expect(r.meta).toBe(meta);
			expect(r.lazyConnected).toBe(false);
		}
	});

	it("returns error when tool not found and no config", async () => {
		const r = await resolveTool("missing", makeDeps());
		expect(isResolveError(r)).toBe(true);
		if (isResolveError(r)) expect(r.message).toContain("not found");
	});

	it("prefix match: github_create_issue -> server github, tool create_issue (C1)", async () => {
		const meta = tool("create_issue", "github");
		const allMeta = new Map([["github", [meta]]]);
		const deps = makeDeps({ getAllMetadata: vi.fn(() => allMeta) });
		const r = await resolveTool("github_create_issue", deps);
		expect(isResolveError(r)).toBe(false);
		if (!isResolveError(r)) expect(r.meta).toBe(meta);
	});

	it("prefix match fails when no underscore", async () => {
		const r = await resolveTool("missing", makeDeps());
		expect(isResolveError(r)).toBe(true);
	});

	it("prefix match fails when server not found", async () => {
		const deps = makeDeps({ getAllMetadata: vi.fn(() => new Map()) });
		const r = await resolveTool("unknown_tool", deps);
		expect(isResolveError(r)).toBe(true);
	});

	it("finds tool in allMetadata by name before prefix", async () => {
		const meta = tool("my_tool", "srv");
		const allMeta = new Map([["srv", [meta]]]);
		const deps = makeDeps({ getAllMetadata: vi.fn(() => allMeta) });
		const r = await resolveTool("my_tool", deps);
		expect(isResolveError(r)).toBe(false);
		if (!isResolveError(r)) expect(r.meta).toBe(meta);
	});
});

describe("isResolveError", () => {
	it("returns true for error objects", () => {
		expect(isResolveError({ message: "err" })).toBe(true);
	});

	it("returns false for success objects", () => {
		expect(isResolveError({ meta: tool("x", "s"), lazyConnected: false })).toBe(false);
	});
});
