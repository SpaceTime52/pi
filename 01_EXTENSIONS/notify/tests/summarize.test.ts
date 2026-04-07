import type { AssistantMessage, Model } from "@mariozechner/pi-ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { completeSimple } = vi.hoisted(() => ({ completeSimple: vi.fn() }));
vi.mock("@mariozechner/pi-ai", async () => {
	const actual = await vi.importActual<typeof import("@mariozechner/pi-ai")>("@mariozechner/pi-ai");
	return { ...actual, completeSimple };
});

import { resolveKoreanNotificationSummary } from "../src/summarize.js";

const model = {
	api: "openai-responses",
	provider: "openai",
	id: "gpt-5.4-mini",
	name: "GPT",
	reasoning: true,
	input: ["text"],
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	contextWindow: 200000,
	maxTokens: 4096,
} satisfies Model<"openai-responses">;

const registry = { getApiKeyAndHeaders: vi.fn(async () => ({ ok: true as const, apiKey: "token" })) };

function message(content: AssistantMessage["content"], stopReason: AssistantMessage["stopReason"] = "stop"): AssistantMessage {
	return {
		role: "assistant",
		content,
		api: "openai-responses",
		provider: "openai",
		model: "gpt-5.4-mini",
		usage: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason,
		timestamp: 0,
	};
}

describe("resolveKoreanNotificationSummary", () => {
	beforeEach(() => {
		completeSimple.mockReset();
		registry.getApiKeyAndHeaders.mockReset();
		registry.getApiKeyAndHeaders.mockResolvedValue({ ok: true, apiKey: "token" });
	});

	it("uses an LLM-generated Korean one-line summary", async () => {
		completeSimple.mockResolvedValue(message([{ type: "text", text: "로그인 타이틀 수정 완료" }]));
		expect(await resolveKoreanNotificationSummary("Fixed login title and tests", "Fix auth tests", model, registry)).toBe("로그인 타이틀 수정 완료");
		expect(completeSimple).toHaveBeenCalledWith(
			model,
			expect.objectContaining({
				systemPrompt: expect.stringContaining("Never output generic placeholders like Ready for input."),
				messages: [expect.objectContaining({ content: expect.stringContaining("Session title: Fix auth tests") })],
			}),
			expect.not.objectContaining({ reasoning: expect.anything() }),
		);
	});

	it("normalizes labeled or multiline model output down to one summary line", async () => {
		completeSimple.mockResolvedValue(message([
			{ type: "thinking", thinking: "hidden" },
			{ type: "text", text: "요약: 로그인 타이틀 수정 완료\n테스트 추가" },
		]));
		expect(await resolveKoreanNotificationSummary("Fixed login title and tests", undefined, model, registry)).toBe("로그인 타이틀 수정 완료");
		expect(completeSimple).toHaveBeenCalledWith(
			model,
			expect.objectContaining({ messages: [expect.objectContaining({ content: expect.stringContaining("Session title: (none)") })] }),
			expect.any(Object),
		);
	});

	it("ignores empty input, missing models, and auth failures", async () => {
		expect(await resolveKoreanNotificationSummary("  \n\t ", "Fix auth", model, registry)).toBeUndefined();
		expect(await resolveKoreanNotificationSummary("Fixed login", "Fix auth", undefined, registry)).toBeUndefined();
		registry.getApiKeyAndHeaders.mockResolvedValue({ ok: false, error: "no auth" });
		expect(await resolveKoreanNotificationSummary("Fixed login", "Fix auth", model, registry)).toBeUndefined();
	});

	it("returns undefined when the provider errors, output is empty, or the call throws", async () => {
		completeSimple.mockResolvedValueOnce(message([], "error"));
		expect(await resolveKoreanNotificationSummary("Fixed login", "Fix auth", model, registry)).toBeUndefined();
		completeSimple.mockResolvedValueOnce(message([{ type: "thinking", thinking: "hidden" }]));
		expect(await resolveKoreanNotificationSummary("Fixed login", "Fix auth", model, registry)).toBeUndefined();
		completeSimple.mockRejectedValue(new Error("boom"));
		expect(await resolveKoreanNotificationSummary("Fixed login", "Fix auth", model, registry)).toBeUndefined();
	});
});
