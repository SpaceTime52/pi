import { describe, expect, it, vi } from "vitest";
import { proxyCall } from "../src/proxy-call.js";
import type { CallDeps } from "../src/proxy-call.js";
import type { McpContent } from "../src/types-server.js";

describe("proxyCall errors", () => {
	const baseDeps: CallDeps = {
		findTool: vi.fn((name: string) =>
			name === "tool1"
				? { name: "tool1", originalName: "tool1", serverName: "s1", description: "d" }
				: undefined,
		),
		getAllMetadata: vi.fn(() => new Map()),
		getConfig: vi.fn(() => null),
		connectServer: vi.fn(async () => {}),
		getBackoffMs: vi.fn(() => 0),
		getFailure: vi.fn(() => undefined),
		getOrConnect: vi.fn(async () => ({
			name: "s1",
			client: {
				callTool: vi.fn(async () => ({ content: [{ type: "text", text: "ok" }] })),
				readResource: vi.fn(async () => ({ contents: [] })),
			},
			status: "connected" as const, lastUsedAt: 0, inFlight: 0,
		})),
		checkConsent: vi.fn(async () => true),
		transform: vi.fn((c: McpContent) => ({ type: "text" as const, text: c.text ?? "" })),
	};

	it("returns error when tool not found", async () => {
		const result = await proxyCall("missing", {}, baseDeps);
		expect(result.content[0].text).toContain("not found");
	});

	it("returns error when consent denied", async () => {
		const deps = { ...baseDeps, checkConsent: vi.fn(async () => false) };
		const result = await proxyCall("tool1", {}, deps);
		expect(result.content[0].text).toContain("denied");
	});

	it("propagates connection error", async () => {
		const deps = {
			...baseDeps,
			getOrConnect: vi.fn(async () => { throw new Error("connection failed"); }),
		};
		await expect(proxyCall("tool1", {}, deps)).rejects.toThrow("connection failed");
	});

	it("propagates callTool error", async () => {
		const failClient = {
			callTool: vi.fn(async () => { throw new Error("call failed"); }),
			readResource: vi.fn(async () => ({ contents: [] })),
		};
		const deps = {
			...baseDeps,
			getOrConnect: vi.fn(async () => ({
				name: "s1", client: failClient,
				status: "connected" as const, lastUsedAt: 0, inFlight: 0,
			})),
		};
		await expect(proxyCall("tool1", {}, deps)).rejects.toThrow("call failed");
	});

	it("decrements inFlight even on error", async () => {
		const conn = {
			name: "s1",
			client: {
				callTool: vi.fn(async () => { throw new Error("boom"); }),
				readResource: vi.fn(async () => ({ contents: [] })),
			},
			status: "connected" as const, lastUsedAt: 0, inFlight: 0,
		};
		const deps = { ...baseDeps, getOrConnect: vi.fn(async () => conn) };
		await expect(proxyCall("tool1", {}, deps)).rejects.toThrow("boom");
		expect(conn.inFlight).toBe(0);
	});

	it("handles empty content array from server", async () => {
		const deps = {
			...baseDeps,
			getOrConnect: vi.fn(async () => ({
				name: "s1",
				client: {
					callTool: vi.fn(async () => ({ content: [] })),
					readResource: vi.fn(async () => ({ contents: [] })),
				},
				status: "connected" as const, lastUsedAt: 0, inFlight: 0,
			})),
		};
		const result = await proxyCall("tool1", {}, deps);
		expect(result.content).toEqual([]);
	});
});
