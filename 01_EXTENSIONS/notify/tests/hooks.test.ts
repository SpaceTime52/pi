import { beforeEach, describe, expect, it, vi } from "vitest";

const { notify } = vi.hoisted(() => ({ notify: vi.fn() }));
const { resolveKoreanNotificationSummary } = vi.hoisted(() => ({ resolveKoreanNotificationSummary: vi.fn() }));

vi.mock("../src/notify.js", () => ({ notify }));
vi.mock("../src/summarize.js", () => ({ resolveKoreanNotificationSummary }));

import { createAgentEndHandler } from "../src/hooks.js";

describe("createAgentEndHandler", () => {
	beforeEach(() => {
		notify.mockReset();
		resolveKoreanNotificationSummary.mockReset();
	});

	it("prefers the Korean summary when available", async () => {
		const modelRegistry = { getApiKeyAndHeaders: vi.fn() };
		resolveKoreanNotificationSummary.mockResolvedValue("로그인 문구 수정 완료");
		await createAgentEndHandler()(
			{ messages: [{ role: "assistant", content: "Fixed login copy" }] },
			{ model: undefined, modelRegistry, sessionManager: { getSessionName: () => "notify" } },
		);
		expect(resolveKoreanNotificationSummary).toHaveBeenCalledWith("Fixed login copy", undefined, modelRegistry);
		expect(notify).toHaveBeenCalledWith("notify", "로그인 문구 수정 완료");
	});

	it("falls back to the local Korean body", async () => {
		resolveKoreanNotificationSummary.mockResolvedValue(undefined);
		await createAgentEndHandler()(
			{ messages: [{ role: "assistant", content: "로그인 문구 수정 완료" }] },
			{ model: undefined, modelRegistry: { getApiKeyAndHeaders: vi.fn() }, sessionManager: { getSessionName: () => undefined } },
		);
		expect(notify).toHaveBeenCalledWith("π", "로그인 문구 수정 완료");
	});
});
