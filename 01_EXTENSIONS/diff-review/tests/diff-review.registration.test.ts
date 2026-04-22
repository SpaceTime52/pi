import { describe, expect, it, vi } from "vitest";
import registerDiffReview from "../src/diff-review.ts";

describe("diff-review registration", () => {
	it("registers the command and shutdown hook", () => {
		const registerCommand = vi.fn();
		const on = vi.fn();
		registerDiffReview({ exec: vi.fn(), registerCommand, on });
		expect(registerCommand).toHaveBeenCalledWith("diff-review", expect.any(Object));
		expect(on).toHaveBeenCalledWith("session_shutdown", expect.any(Function));
	});
});
