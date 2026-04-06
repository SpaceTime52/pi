import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { notify } from "../src/notify.js";

describe("notify", () => {
	const originalEnv = process.env;
	const write = vi.fn();

	beforeEach(() => {
		write.mockClear();
		process.env = { ...originalEnv };
		delete process.env.KITTY_WINDOW_ID;
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	it("uses stdout.write by default", () => {
		const spy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
		notify("Pi", "Ready");
		expect(spy).toHaveBeenCalled();
		spy.mockRestore();
	});

	it("OSC 777 by default", () => {
		notify("Pi", "Ready", write);
		expect(write).toHaveBeenCalledWith("\x1b]777;notify;Pi;Ready\x07");
	});

	it("OSC 99 when KITTY_WINDOW_ID is set", () => {
		process.env.KITTY_WINDOW_ID = "1";
		notify("Pi", "Ready", write);
		expect(write).toHaveBeenCalledWith("\x1b]99;i=1:d=0;Pi\x1b\\");
		expect(write).toHaveBeenCalledWith("\x1b]99;i=1:p=body;Ready\x1b\\");
	});
});
