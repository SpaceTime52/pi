import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";
import extension from "../src/index.ts";

describe("claude-code-ui index", () => {
	it("registers tools and the session_start handler", () => {
		const registerTool = vi.fn();
		const on = vi.fn();
		extension({ registerTool, on } as ExtensionAPI);
		expect(registerTool).toHaveBeenCalledTimes(4);
		expect(on).toHaveBeenCalledWith("session_start", expect.any(Function));
	});
});
