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

describe("resolveTool lazy connect (C2)", () => {
	it("lazy connects unconfigured server and finds tool", async () => {
		const meta = tool("deploy", "ci");
		let called = false;
		const deps = makeDeps({
			getAllMetadata: vi.fn(() => called ? new Map([["ci", [meta]]]) : new Map()),
			getConfig: vi.fn(() => ({ mcpServers: { ci: {} } })),
			connectServer: vi.fn(async () => { called = true; }),
		});
		const r = await resolveTool("deploy", deps);
		expect(isResolveError(r)).toBe(false);
		if (!isResolveError(r)) {
			expect(r.meta).toBe(meta);
			expect(r.lazyConnected).toBe(true);
		}
		expect(deps.connectServer).toHaveBeenCalledWith("ci");
	});

	it("skips already-known servers during lazy connect", async () => {
		const allMeta = new Map([["known", []]]);
		const deps = makeDeps({
			getAllMetadata: vi.fn(() => allMeta),
			getConfig: vi.fn(() => ({ mcpServers: { known: {} } })),
		});
		const r = await resolveTool("missing", deps);
		expect(isResolveError(r)).toBe(true);
		expect(deps.connectServer).not.toHaveBeenCalled();
	});
});

describe("resolveTool backoff (C4)", () => {
	it("skips server under backoff during lazy connect", async () => {
		const deps = makeDeps({
			getConfig: vi.fn(() => ({ mcpServers: { bad: {} } })),
			getBackoffMs: vi.fn(() => 5000),
			getFailure: vi.fn(() => ({ at: Date.now() - 1000, count: 1 })),
		});
		const r = await resolveTool("some_tool", deps);
		expect(isResolveError(r)).toBe(true);
		expect(deps.connectServer).not.toHaveBeenCalled();
	});

	it("does not skip server when backoff has expired", async () => {
		const meta = tool("run", "srv");
		let called = false;
		const deps = makeDeps({
			getAllMetadata: vi.fn(() => called ? new Map([["srv", [meta]]]) : new Map()),
			getConfig: vi.fn(() => ({ mcpServers: { srv: {} } })),
			getBackoffMs: vi.fn(() => 1000),
			getFailure: vi.fn(() => ({ at: Date.now() - 5000, count: 1 })),
			connectServer: vi.fn(async () => { called = true; }),
		});
		const r = await resolveTool("run", deps);
		expect(isResolveError(r)).toBe(false);
		expect(deps.connectServer).toHaveBeenCalledWith("srv");
	});

	it("allows connect when backoffMs > 0 but failure record cleared", async () => {
		const meta = tool("run", "cleared");
		let called = false;
		const deps = makeDeps({
			getAllMetadata: vi.fn(() => called ? new Map([["cleared", [meta]]]) : new Map()),
			getConfig: vi.fn(() => ({ mcpServers: { cleared: {} } })),
			getBackoffMs: vi.fn(() => 2000),
			getFailure: vi.fn(() => undefined),
			connectServer: vi.fn(async () => { called = true; }),
		});
		const r = await resolveTool("run", deps);
		expect(isResolveError(r)).toBe(false);
		expect(deps.connectServer).toHaveBeenCalledWith("cleared");
	});
});
