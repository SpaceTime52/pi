import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("child_process", () => {
	const { EventEmitter } = require("events");
	const { PassThrough } = require("stream");
	return { spawn: vi.fn(() => Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough(), kill: vi.fn() })) };
});

import { spawn } from "child_process";
import { spawnAndCollect } from "../src/spawn.js";

const getLastProc = () => (spawn as ReturnType<typeof vi.fn>).mock.results.at(-1)?.value;
class ManualAbortSignal implements AbortSignal {
	aborted = false;
	onabort: ((this: AbortSignal, ev: Event) => void) | null = null;
	reason: unknown;
	private listeners: EventListener[] = [];
	addEventListener(_type: string, callback: EventListenerOrEventListenerObject | null) {
		if (typeof callback === "function") this.listeners.push(callback);
	}
	removeEventListener(): void {}
	dispatchEvent(_event: Event): boolean { return true; }
	triggerAbort() {
		for (const listener of this.listeners) listener(new Event("abort"));
	}
	throwIfAborted() { if (this.aborted) throw this.reason; }
}

describe("spawnAndCollect basic errors", () => {
	beforeEach(() => { vi.clearAllMocks(); });
	afterEach(() => { vi.useRealTimers(); });

	it("returns exit errors, spawn errors, and empty-success diagnostics", async () => {
		const exited = spawnAndCollect("node", [], 2, "worker");
		getLastProc().stderr.emit("data", Buffer.from("boom"));
		getLastProc().stdout.end();
		getLastProc().emit("close", 1);
		await expect(exited).resolves.toMatchObject({ error: "boom" });
		const missing = spawnAndCollect("nonexistent", [], 4, "scout");
		getLastProc().emit("error", new Error("ENOENT"));
		await expect(missing).rejects.toThrow("ENOENT");
		const empty = spawnAndCollect("node", [], 5, "scout");
		getLastProc().stdout.write("not json\n\n");
		getLastProc().stdout.end();
		getLastProc().emit("close", 0);
		await expect(empty).resolves.toMatchObject({ error: "Subagent finished without a visible assistant result", output: expect.stringContaining("source: empty") });
	});

	it("handles abort signals before, during, and after settlement", async () => {
		const ac = new AbortController();
		const aborted = spawnAndCollect("node", [], 6, "scout", ac.signal);
		const proc = getLastProc();
		proc.kill = vi.fn();
		ac.abort();
		await expect(aborted).rejects.toThrow("Aborted");
		expect(proc.kill).toHaveBeenCalledWith("SIGTERM");
		proc.emit("error", new Error("late error"));
		proc.emit("close", 1);
		const signal = new ManualAbortSignal();
		const duplicate = spawnAndCollect("node", [], 61, "scout", signal);
		getLastProc().kill = vi.fn();
		signal.triggerAbort();
		await expect(duplicate).rejects.toThrow("Aborted");
		signal.triggerAbort();
		expect(getLastProc().kill).toHaveBeenCalledTimes(1);
	});

	it("aborts immediately when the signal is already canceled", async () => {
		const ac = new AbortController();
		ac.abort();
		const pending = spawnAndCollect("node", [], 7, "scout", ac.signal);
		await expect(pending).rejects.toThrow("Aborted");
		expect(getLastProc().kill).toHaveBeenCalledWith("SIGTERM");
	});
});
