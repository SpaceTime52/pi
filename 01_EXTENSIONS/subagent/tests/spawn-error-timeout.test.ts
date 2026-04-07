import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("child_process", () => {
	const { EventEmitter } = require("events");
	const { PassThrough } = require("stream");
	return { spawn: vi.fn(() => Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough(), kill: vi.fn() })) };
});

import { spawn } from "child_process";
import { spawnAndCollect } from "../src/spawn.js";

const getLastProc = () => (spawn as ReturnType<typeof vi.fn>).mock.results.at(-1)?.value;

describe("spawnAndCollect timeouts", () => {
	beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); });
	afterEach(() => { vi.useRealTimers(); });

	it("escalates to SIGKILL if aborted child does not exit", async () => {
		const ac = new AbortController();
		const pending = spawnAndCollect("node", [], 8, "scout", ac.signal);
		getLastProc().kill = vi.fn();
		ac.abort();
		await expect(pending).rejects.toThrow("Aborted");
		vi.advanceTimersByTime(5000);
		expect(getLastProc().kill).toHaveBeenNthCalledWith(1, "SIGTERM");
		expect(getLastProc().kill).toHaveBeenNthCalledWith(2, "SIGKILL");
	});

	it("rejects on hard and idle timeouts", async () => {
		const hard = spawnAndCollect("node", [], 9, "scout", undefined, undefined, { hardTimeoutMs: 1000 });
		getLastProc().kill = vi.fn();
		vi.advanceTimersByTime(1000);
		await expect(hard).rejects.toThrow("hard timeout");
		expect(getLastProc().kill).toHaveBeenCalledWith("SIGTERM");
		const idle = spawnAndCollect("node", [], 10, "scout", undefined, undefined, { idleTimeoutMs: 1000 });
		getLastProc().kill = vi.fn();
		vi.advanceTimersByTime(1000);
		await expect(idle).rejects.toThrow("idle timeout");
		expect(getLastProc().kill).toHaveBeenCalledWith("SIGTERM");
	});

	it("resets idle timeout when child produces output", async () => {
		const pending = spawnAndCollect("node", [], 11, "scout", undefined, undefined, { idleTimeoutMs: 1000 });
		getLastProc().kill = vi.fn();
		vi.advanceTimersByTime(900);
		getLastProc().stdout.write("not json\n");
		vi.advanceTimersByTime(900);
		expect(getLastProc().kill).not.toHaveBeenCalled();
		getLastProc().stdout.end();
		getLastProc().emit("close", 1);
		await expect(pending).resolves.toMatchObject({ error: "Process exited with code 1" });
	});
});
