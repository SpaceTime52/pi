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
		notify("π", "");
		expect(spy).toHaveBeenCalled();
		spy.mockRestore();
	});

	it("uses OSC 777 by default", () => {
		notify("작업 완료", "", write);
		expect(write).toHaveBeenCalledWith("\x1b]777;notify;작업 완료;\x07");
	});

	it("uses OSC 99 in Kitty", () => {
		process.env.KITTY_WINDOW_ID = "1";
		notify("작업 완료", "", write);
		expect(write).toHaveBeenCalledTimes(1);
		expect(write).toHaveBeenCalledWith("\x1b]99;i=1:d=0;작업 완료\x1b\\");
		write.mockClear();
		notify("작업 완료", "본문", write);
		expect(write).toHaveBeenCalledWith("\x1b]99;i=1:d=0;작업 완료\x1b\\");
		expect(write).toHaveBeenCalledWith("\x1b]99;i=1:p=body;본문\x1b\\");
	});

	it("sanitizes and allows an empty body", () => {
		notify("π;\x1bBad", "Ready\nnow;", write);
		expect(write).toHaveBeenCalledWith("\x1b]777;notify;π Bad;Ready now\x07");
		write.mockClear();
		notify("\n;\t", "\n;\t", write);
		expect(write).toHaveBeenCalledWith("\x1b]777;notify;π;\x07");
	});
});
