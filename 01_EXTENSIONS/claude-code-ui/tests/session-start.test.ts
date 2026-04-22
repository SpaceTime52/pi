import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";

const applyClaudeChrome = vi.fn();
vi.mock("../src/chrome.ts", () => ({ applyClaudeChrome }));

const { onSessionStart } = await import("../src/session-start.ts");

describe("onSessionStart", () => {
	it("only applies chrome when UI is available", async () => {
		await onSessionStart({}, { hasUI: false } as ExtensionContext);
		await onSessionStart({}, { hasUI: true } as ExtensionContext);
		expect(applyClaudeChrome).toHaveBeenCalledTimes(1);
	});
});
