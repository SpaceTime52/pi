import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { startIdleTimer, stopIdleTimer } from "../src/lifecycle-idle.js";

type Conn = { name: string; lastUsedAt: number; status: string; inFlight: number };

function setup(conns: [string, Conn][], servers: Record<string, { lifecycle?: string; idleTimeout?: number }> = {}) {
	const closeFn = vi.fn<(name: string) => Promise<void>>().mockResolvedValue(undefined);
	const connections = new Map(conns);
	for (const [k] of conns) servers[k] ??= {};
	return { closeFn, connections, servers };
}

describe("lifecycle-idle", () => {
	beforeEach(() => { vi.useFakeTimers(); stopIdleTimer(); });
	afterEach(() => { stopIdleTimer(); vi.useRealTimers(); });

	it("closes idle non-keep-alive servers after timeout", () => {
		const { closeFn, connections, servers } = setup([
			["s1", { name: "s1", lastUsedAt: Date.now() - 700_000, status: "connected", inFlight: 0 }],
		]);
		startIdleTimer({ connections, servers, closeFn, timeoutMs: 600_000, intervalMs: 60_000 });
		vi.advanceTimersByTime(60_000);
		expect(closeFn).toHaveBeenCalledWith("s1");
	});

	it("skips keep-alive servers", () => {
		const { closeFn, connections, servers } = setup(
			[["ka", { name: "ka", lastUsedAt: Date.now() - 700_000, status: "connected", inFlight: 0 }]],
			{ ka: { lifecycle: "keep-alive" } },
		);
		startIdleTimer({ connections, servers, closeFn, timeoutMs: 600_000, intervalMs: 60_000 });
		vi.advanceTimersByTime(60_000);
		expect(closeFn).not.toHaveBeenCalled();
	});

	it("skips recently-used servers", () => {
		const { closeFn, connections, servers } = setup([
			["s1", { name: "s1", lastUsedAt: Date.now(), status: "connected", inFlight: 0 }],
		]);
		startIdleTimer({ connections, servers, closeFn, timeoutMs: 600_000, intervalMs: 60_000 });
		vi.advanceTimersByTime(60_000);
		expect(closeFn).not.toHaveBeenCalled();
	});

	it("stopIdleTimer prevents further checks", () => {
		const { closeFn, connections, servers } = setup([
			["s1", { name: "s1", lastUsedAt: Date.now() - 700_000, status: "connected", inFlight: 0 }],
		]);
		startIdleTimer({ connections, servers, closeFn, timeoutMs: 600_000, intervalMs: 60_000 });
		stopIdleTimer();
		vi.advanceTimersByTime(60_000);
		expect(closeFn).not.toHaveBeenCalled();
	});

	it("skips servers not in connected status", () => {
		const { closeFn, connections, servers } = setup([
			["s1", { name: "s1", lastUsedAt: Date.now() - 700_000, status: "closed", inFlight: 0 }],
		]);
		startIdleTimer({ connections, servers, closeFn, timeoutMs: 600_000, intervalMs: 60_000 });
		vi.advanceTimersByTime(60_000);
		expect(closeFn).not.toHaveBeenCalled();
	});

	it("calls logger.info when logger is provided", () => {
		const { closeFn, connections, servers } = setup([
			["s1", { name: "s1", lastUsedAt: Date.now() - 700_000, status: "connected", inFlight: 0 }],
		]);
		const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
		startIdleTimer({ connections, servers, closeFn, timeoutMs: 600_000, intervalMs: 60_000, logger });
		vi.advanceTimersByTime(60_000);
		expect(logger.info).toHaveBeenCalled();
	});

	it("skips servers with in-flight requests", () => {
		const { closeFn, connections, servers } = setup([
			["s1", { name: "s1", lastUsedAt: Date.now() - 700_000, status: "connected", inFlight: 2 }],
		]);
		startIdleTimer({ connections, servers, closeFn, timeoutMs: 600_000, intervalMs: 60_000 });
		vi.advanceTimersByTime(60_000);
		expect(closeFn).not.toHaveBeenCalled();
	});

	it("uses per-server idleTimeout override", () => {
		const { closeFn, connections, servers } = setup(
			[["s1", { name: "s1", lastUsedAt: Date.now() - 200_000, status: "connected", inFlight: 0 }]],
			{ s1: { idleTimeout: 100_000 } },
		);
		startIdleTimer({ connections, servers, closeFn, timeoutMs: 600_000, intervalMs: 60_000 });
		vi.advanceTimersByTime(60_000);
		expect(closeFn).toHaveBeenCalledWith("s1");
	});
});
