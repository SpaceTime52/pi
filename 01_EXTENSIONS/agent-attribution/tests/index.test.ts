import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";
import extension from "../src/index.js";

describe("agent attribution extension", () => {
	it("exports an extension function", () => {
		expect(typeof extension).toBe("function");
	});

	it("registers lifecycle handlers and command", () => {
		const on = vi.fn();
		const registerCommand = vi.fn();
		const getSessionName = vi.fn();
		extension({ on, registerCommand, getSessionName } as unknown as ExtensionAPI);

		expect(on).toHaveBeenCalledWith("session_start", expect.any(Function));
		expect(on).toHaveBeenCalledWith("agent_start", expect.any(Function));
		expect(on).toHaveBeenCalledWith("tool_execution_start", expect.any(Function));
		expect(on).toHaveBeenCalledWith("tool_execution_end", expect.any(Function));
		expect(on).toHaveBeenCalledWith("agent_end", expect.any(Function));
		expect(on).toHaveBeenCalledWith("session_shutdown", expect.any(Function));
		expect(registerCommand).toHaveBeenCalledWith("agent-attribution", expect.objectContaining({ handler: expect.any(Function) }));
	});
});
