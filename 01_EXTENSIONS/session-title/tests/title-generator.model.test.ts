import { beforeEach, describe, expect, it, vi } from "vitest";

const { completeSimple } = vi.hoisted(() => ({ completeSimple: vi.fn() }));
vi.mock("@mariozechner/pi-ai", () => ({ completeSimple }));

import { generateSessionTitle } from "../src/title-generator.ts";

const ctx = { model: { id: "model" }, modelRegistry: { getApiKeyAndHeaders: async () => ({ ok: true, apiKey: "key" }) } };

describe("title generator model path", () => {
	beforeEach(() => completeSimple.mockReset());

	it("returns the generated title when the model succeeds", async () => {
		completeSimple.mockResolvedValue({ stopReason: "stop", content: [{ type: "text", text: "Session title: Add session title extension" }] });
		await expect(generateSessionTitle(ctx, "Please add terminal title sync.")).resolves.toBe("Add session title extension");
		expect(completeSimple).toHaveBeenCalledTimes(1);
	});

	it("falls back when the model stops early or returns an empty title", async () => {
		completeSimple.mockResolvedValueOnce({ stopReason: "length", content: [{ type: "text", text: "Truncated" }] });
		completeSimple.mockResolvedValueOnce({ stopReason: "stop", content: [{ type: "text", text: "" }] });
		await expect(generateSessionTitle(ctx, "Please add terminal title sync.")).resolves.toBe("add terminal title sync");
		await expect(generateSessionTitle(ctx, "Please add terminal title sync.")).resolves.toBe("add terminal title sync");
	});
});
