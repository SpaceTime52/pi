import { describe, expect, it, vi } from "vitest";
import { proxyCall } from "../src/proxy-call.js";
import type { CallDeps } from "../src/proxy-call.js";
import type { McpContent } from "../src/types-server.js";

const noop = vi.fn(async () => ({ contents: [] }));
const noopCall = vi.fn(async () => ({ content: [] }));
const conn = (rr: typeof noop) => ({
	name: "s", status: "connected" as const, lastUsedAt: 0, inFlight: 0,
	client: { callTool: vi.fn(), readResource: rr },
});

function makeDeps(): CallDeps {
	return {
		findTool: vi.fn(() => undefined), getAllMetadata: vi.fn(() => new Map()),
		getConfig: vi.fn(() => null), connectServer: vi.fn(async () => {}),
		getBackoffMs: vi.fn(() => 0), getFailure: vi.fn(() => undefined),
		getOrConnect: vi.fn(async () => ({
			name: "s", client: { callTool: noopCall, readResource: noop },
			status: "connected" as const, lastUsedAt: 0, inFlight: 0,
		})),
		checkConsent: vi.fn(async () => true),
		transform: vi.fn((c: McpContent) => ({ type: "text" as const, text: c.text ?? "" })),
	};
}

describe("proxyCall resource execution (C3)", () => {
	it("uses readResource for tools with resourceUri", async () => {
		const deps = makeDeps();
		deps.findTool = vi.fn(() => ({
			name: "readme", originalName: "readme", serverName: "gh",
			description: "d", resourceUri: "file:///README.md",
		}));
		const rr = vi.fn(async () => ({ contents: [{ uri: "file:///README.md", text: "# Hi" }] }));
		deps.getOrConnect = vi.fn(async () => conn(rr));
		const result = await proxyCall("readme", undefined, deps);
		expect(rr).toHaveBeenCalledWith({ uri: "file:///README.md" });
		expect(result.content).toHaveLength(1);
	});

	it("uses blob when text is absent in resource response", async () => {
		const deps = makeDeps();
		deps.findTool = vi.fn(() => ({
			name: "img", originalName: "img", serverName: "s",
			description: "d", resourceUri: "file:///img.png",
		}));
		const rr = vi.fn(async () => ({ contents: [{ uri: "u", blob: "b64" }] }));
		deps.getOrConnect = vi.fn(async () => conn(rr));
		await proxyCall("img", undefined, deps);
		expect(deps.transform).toHaveBeenCalledWith(
			{ type: "text", text: "b64" }, 0, [{ type: "text", text: "b64" }],
		);
	});

	it("uses empty string when both text and blob absent", async () => {
		const deps = makeDeps();
		deps.findTool = vi.fn(() => ({
			name: "e", originalName: "e", serverName: "s",
			description: "d", resourceUri: "file:///e",
		}));
		const rr = vi.fn(async () => ({ contents: [{ uri: "u" }] }));
		deps.getOrConnect = vi.fn(async () => conn(rr));
		await proxyCall("e", undefined, deps);
		expect(deps.transform).toHaveBeenCalledWith(
			{ type: "text", text: "" }, 0, [{ type: "text", text: "" }],
		);
	});

	it("does not call readResource for tools without resourceUri", async () => {
		const deps = makeDeps();
		deps.findTool = vi.fn(() => ({
			name: "run", originalName: "run", serverName: "s", description: "d",
		}));
		const rr = vi.fn(async () => ({ contents: [] }));
		const ct = vi.fn(async () => ({ content: [{ type: "text", text: "ok" }] }));
		deps.getOrConnect = vi.fn(async () => ({
			name: "s", client: { callTool: ct, readResource: rr },
			status: "connected" as const, lastUsedAt: 0, inFlight: 0,
		}));
		await proxyCall("run", { x: 1 }, deps);
		expect(ct).toHaveBeenCalled();
		expect(rr).not.toHaveBeenCalled();
	});
});
