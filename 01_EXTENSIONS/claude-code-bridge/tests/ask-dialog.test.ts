import { afterEach, describe, expect, it, vi } from "vitest";
import {
	ASK_CONFIRM_TIMEOUT_MS,
	ClaudeAskDialog,
	confirmClaudeAskWithUi,
} from "../src/runtime/ask-dialog.js";

const theme = {
	fg: (_color: string, text: string) => text,
	bg: (_color: string, text: string) => text,
	bold: (text: string) => text,
};

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe("claude ask dialog", () => {
	it("shows countdown beside no and times out to false", () => {
		vi.useFakeTimers();
		const done = vi.fn();
		const requestRender = vi.fn();
		const dialog = new ClaudeAskDialog(theme, "Hook asks for confirmation.", "Allow Read?", ASK_CONFIRM_TIMEOUT_MS, done, requestRender);

		expect(dialog.render(72).join("\n")).toContain("No (10s)");

		vi.advanceTimersByTime(1_100);
		expect(dialog.render(72).join("\n")).toContain("No (9s)");
		expect(requestRender).toHaveBeenCalled();

		vi.advanceTimersByTime(9_500);
		expect(done).toHaveBeenCalledWith(false);
		expect(done).toHaveBeenCalledTimes(1);
	});

	it("confirms selected option from keyboard", () => {
		const done = vi.fn();
		const dialog = new ClaudeAskDialog(theme, "Hook asks for confirmation.", "Allow Edit?", ASK_CONFIRM_TIMEOUT_MS, done, vi.fn());

		dialog.handleInput("\t");
		dialog.handleInput("\r");

		expect(done).toHaveBeenCalledWith(false);
	});

	it("falls back to built-in confirm with 10s timeout when custom ui is unavailable", async () => {
		const confirm = vi.fn(async () => true);
		const custom = vi.fn(async () => undefined);
		const result = await confirmClaudeAskWithUi(
			{ confirm, custom },
			"Need approval.",
			"Allow Bash?",
		);

		expect(result).toBe(true);
		expect(custom).toHaveBeenCalled();
		expect(confirm).toHaveBeenCalledWith(
			"Claude hook confirmation",
			"Need approval.\n\nAllow Bash?",
			{ timeout: 10_000 },
		);
	});
});
