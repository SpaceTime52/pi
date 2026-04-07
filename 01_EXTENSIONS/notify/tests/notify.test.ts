import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { notify } from "../src/notify.js";

describe("notify transport", () => {
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
		notify("π", "Done");
		expect(spy).toHaveBeenCalled();
		spy.mockRestore();
	});

	it("uses OSC 777 by default", () => {
		notify("π", "Done", write);
		expect(write).toHaveBeenCalledWith("\x1b]777;notify;π;Done\x07");
	});

	it("uses OSC 99 in Kitty", () => {
		process.env.KITTY_WINDOW_ID = "1";
		notify("π", "Done", write);
		expect(write).toHaveBeenCalledWith("\x1b]99;i=1:d=0;π\x1b\\");
		expect(write).toHaveBeenCalledWith("\x1b]99;i=1:p=body;Done\x1b\\");
	});

	it("sanitizes and falls back for empty values", () => {
		notify("π;\x1bBad", "Ready\nnow;", write);
		expect(write).toHaveBeenCalledWith("\x1b]777;notify;π Bad;Ready now\x07");
		write.mockClear();
		notify("\n;\t", "\n;\t", write);
		expect(write).toHaveBeenCalledWith("\x1b]777;notify;π;작업 완료\x07");
	});
});
