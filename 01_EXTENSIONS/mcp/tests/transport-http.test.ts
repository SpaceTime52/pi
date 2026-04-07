import { describe, expect, it, vi } from "vitest";
import { createHttpTransport } from "../src/transport-http.js";
import type { TransportFactory } from "../src/transport-http.js";

describe("createHttpTransport", () => {
	it("returns streamable transport on success", async () => {
		const transport = { close: vi.fn() };
		const factory: TransportFactory = {
			createStreamableHttp: vi.fn().mockResolvedValue(transport),
			createSse: vi.fn(),
		};
		const result = await createHttpTransport("http://host/mcp", undefined, factory);
		expect(result).toBe(transport);
		expect(factory.createStreamableHttp).toHaveBeenCalledWith("http://host/mcp", undefined);
		expect(factory.createSse).not.toHaveBeenCalled();
	});

	it("falls back to SSE when streamable fails", async () => {
		const sseTransport = { close: vi.fn() };
		const factory: TransportFactory = {
			createStreamableHttp: vi.fn().mockRejectedValue(new Error("unsupported")),
			createSse: vi.fn().mockResolvedValue(sseTransport),
		};
		const result = await createHttpTransport("http://host/mcp", { key: "v" }, factory);
		expect(result).toBe(sseTransport);
		expect(factory.createSse).toHaveBeenCalledWith("http://host/mcp", { key: "v" });
	});

	it("throws when both transports fail", async () => {
		const factory: TransportFactory = {
			createStreamableHttp: vi.fn().mockRejectedValue(new Error("fail1")),
			createSse: vi.fn().mockRejectedValue(new Error("fail2")),
		};
		await expect(
			createHttpTransport("http://host/mcp", undefined, factory),
		).rejects.toThrow("fail2");
	});

	it("passes headers to both attempts", async () => {
		const transport = { close: vi.fn() };
		const factory: TransportFactory = {
			createStreamableHttp: vi.fn().mockRejectedValue(new Error("no")),
			createSse: vi.fn().mockResolvedValue(transport),
		};
		const headers = { Authorization: "Bearer tok" };
		await createHttpTransport("http://host", headers, factory);
		expect(factory.createStreamableHttp).toHaveBeenCalledWith("http://host", headers);
		expect(factory.createSse).toHaveBeenCalledWith("http://host", headers);
	});

	it("calls probe after streamable creation when provided", async () => {
		const transport = { close: vi.fn() };
		const probe = vi.fn().mockResolvedValue(undefined);
		const factory: TransportFactory = {
			createStreamableHttp: vi.fn().mockResolvedValue(transport),
			createSse: vi.fn(),
			probe,
		};
		const result = await createHttpTransport("http://host/mcp", undefined, factory);
		expect(result).toBe(transport);
		expect(probe).toHaveBeenCalledWith(transport);
		expect(factory.createSse).not.toHaveBeenCalled();
	});

	it("falls back to SSE when probe fails", async () => {
		const streamTransport = { close: vi.fn() };
		const sseTransport = { close: vi.fn() };
		const factory: TransportFactory = {
			createStreamableHttp: vi.fn().mockResolvedValue(streamTransport),
			createSse: vi.fn().mockResolvedValue(sseTransport),
			probe: vi.fn().mockRejectedValue(new Error("probe failed")),
		};
		const result = await createHttpTransport("http://host/mcp", undefined, factory);
		expect(result).toBe(sseTransport);
	});

	it("skips probe when not provided", async () => {
		const transport = { close: vi.fn() };
		const factory: TransportFactory = {
			createStreamableHttp: vi.fn().mockResolvedValue(transport),
			createSse: vi.fn(),
		};
		const result = await createHttpTransport("http://host/mcp", undefined, factory);
		expect(result).toBe(transport);
	});
});
