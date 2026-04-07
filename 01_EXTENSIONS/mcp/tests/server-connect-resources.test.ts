import { describe, expect, it, vi } from "vitest";
import { connectServer } from "../src/server-connect.js";
import type { ConnectDeps } from "../src/server-connect.js";
import type { McpTransport, McpResourceRaw } from "../src/types-server.js";

describe("connectServer resource pagination", () => {
	it("paginates resources across multiple pages", async () => {
		const resources: McpResourceRaw[] = [
			{ uri: "file:///a", name: "doc1" },
			{ uri: "file:///b", name: "doc2" },
		];
		const transport: McpTransport = { close: vi.fn() };
		let resCall = 0;
		const deps: ConnectDeps = {
			createStdioTransport: vi.fn().mockReturnValue(transport),
			createHttpTransport: vi.fn().mockResolvedValue(transport),
			createClient: vi.fn().mockReturnValue({
				callTool: vi.fn(),
				listTools: vi.fn().mockResolvedValue({ tools: [] }),
				listResources: vi.fn().mockImplementation(() => {
					resCall++;
					if (resCall === 1) {
						return Promise.resolve({
							resources: resources.slice(0, 1), nextCursor: "rc1",
						});
					}
					return Promise.resolve({ resources: resources.slice(1) });
				}),
				readResource: vi.fn(), ping: vi.fn(), close: vi.fn(),
				connect: vi.fn().mockResolvedValue(undefined),
			}),
			processEnv: {},
		};
		const conn = await connectServer("s1", { command: "echo" }, deps);
		expect(conn.resources).toHaveLength(2);
	});
});
