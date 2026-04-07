import { describe, expect, it, vi } from "vitest";
import { proxyList, proxyDescribe, proxyStatus } from "../src/proxy-query.js";
import type { ToolMetadata } from "../src/types-tool.js";

describe("proxyList", () => {
	const tools: ToolMetadata[] = [
		{ name: "search", originalName: "search", serverName: "gh", description: "Search" },
		{ name: "pr", originalName: "pr", serverName: "gh", description: "PR ops" },
	];
	const getTools = vi.fn((_server: string) => tools);

	it("lists tools for a server", () => {
		const result = proxyList("gh", getTools);
		expect(result.content[0].text).toContain("search");
		expect(result.content[0].text).toContain("pr");
		expect(result.details).toEqual({ mode: "list", server: "gh" });
	});

	it("returns error when server has no tools", () => {
		const empty = vi.fn((_s: string) => undefined);
		const result = proxyList("none", empty);
		expect(result.content[0].text).toContain("No tools");
		expect(result.details).toEqual({ mode: "list", server: "none" });
	});

	it("lists all servers when no server specified", () => {
		const result = proxyList(undefined, getTools);
		expect(result.content[0].text).toContain("server");
		expect(result.details).toEqual({ mode: "list" });
	});

	it("validates server exists in config", () => {
		const config = { hasServer: (n: string) => n === "gh", serverNames: () => ["gh"] };
		const r = proxyList("bad", vi.fn(() => undefined), config);
		expect(r.content[0].text).toContain("not found in config");
		expect(r.details?.error).toBe("unknown_server");
	});
	it("shows reconnect hint for empty tools with config", () => {
		const config = { hasServer: () => true, serverNames: () => ["gh"] };
		const r = proxyList("gh", vi.fn(() => undefined), config);
		expect(r.content[0].text).toContain("connect");
	});
});

describe("proxyDescribe", () => {
	const find = vi.fn((name: string) => {
		if (name === "search") {
			return {
				name: "search", originalName: "search", serverName: "gh",
				description: "Search repos",
				inputSchema: { type: "object", properties: { q: { type: "string" } }, required: ["q"] },
			};
		}
		return undefined;
	});
	const format = (schema: unknown) => (schema ? "q: string [required]" : "(no parameters)");

	it("describes a tool with schema", () => {
		const result = proxyDescribe("search", find, format);
		expect(result.content[0].text).toContain("search");
		expect(result.content[0].text).toContain("q: string");
		expect(result.details).toEqual({ mode: "describe", server: "gh", tool: "search" });
	});

	it("returns error when tool not found", () => {
		const result = proxyDescribe("missing", find, format);
		expect(result.content[0].text).toContain("not found");
		expect(result.details?.error).toBe("not_found");
	});

	it("requires tool name", () => {
		const result = proxyDescribe(undefined, find, format);
		expect(result.content[0].text).toContain("required");
		expect(result.details).toEqual({ mode: "describe" });
	});
});

describe("proxyStatus", () => {
	it("shows formatted statuses", () => {
		const servers = [
			{ name: "gh", status: "connected" },
			{ name: "slack", status: "closed", cached: true },
			{ name: "db", status: "failed", failedAgo: "2m" },
			{ name: "api", status: "idle" },
		];
		const result = proxyStatus(servers);
		expect(result.content[0].text).toContain("gh: ✓ connected");
		expect(result.content[0].text).toContain("slack: ○ cached");
		expect(result.content[0].text).toContain("db: ✗ failed (2m ago)");
		expect(result.content[0].text).toContain("api: ○ not connected");
		expect(result.details).toEqual({ mode: "status" });
	});

	it("shows message when no servers", () => {
		const r = proxyStatus([]);
		expect(r.content[0].text).toContain("No servers");
		expect(r.details).toEqual({ mode: "status" });
	});
});
