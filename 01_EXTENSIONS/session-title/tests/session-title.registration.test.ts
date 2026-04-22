import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";
import extension from "../src/session-title.ts";

describe("session-title registration", () => {
	it("registers lifecycle handlers", () => {
		const on = vi.fn();
		extension({ on } as ExtensionAPI);
		expect(on).toHaveBeenCalledTimes(5);
		expect(on).toHaveBeenCalledWith("session_start", expect.any(Function));
		expect(on).toHaveBeenCalledWith("before_agent_start", expect.any(Function));
		expect(on).toHaveBeenCalledWith("session_shutdown", expect.any(Function));
	});
});
