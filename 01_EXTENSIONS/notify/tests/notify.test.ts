import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildReadyNotification, notify, sanitizeNotificationText } from "../src/notify.js";

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

	it("sanitizes control characters and semicolons", () => {
		notify("Pi;\x1bBad", "Ready\nnow;", write);
		expect(write).toHaveBeenCalledWith("\x1b]777;notify;Pi Bad;Ready now\x07");
	});

	it("builds a session-aware ready notification", () => {
		expect(buildReadyNotification()).toEqual({ title: "Pi", body: "Ready for input" });
		expect(buildReadyNotification("Fix auth tests")).toEqual({
			title: "Pi · Fix auth tests",
			body: "Ready for input",
		});
	});

	it("falls back to Pi when the notification title sanitizes to empty", () => {
		notify("\n;\t", "Ready", write);
		expect(write).toHaveBeenCalledWith("\x1b]777;notify;Pi;Ready\x07");
	});

	it("sanitizeNotificationText trims whitespace-only noise", () => {
		expect(sanitizeNotificationText("  hi\nthere;\t ")).toBe("hi there");
	});
});
