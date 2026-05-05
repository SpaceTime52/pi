import { beforeEach, describe, expect, it, vi } from "vitest";

const { completeSimple } = vi.hoisted(() => ({ completeSimple: vi.fn() }));
vi.mock("@mariozechner/pi-ai", () => ({ completeSimple }));

import {
	DEFAULT_SUMMARIZER_CANDIDATES,
	generateLiveSummary,
	resolveSummarizer,
} from "../src/summarizer.ts";

const fakeModel = { provider: "anthropic", id: "claude-haiku-4-5" } as never;

describe("resolveSummarizer", () => {
	it("returns tried=no-modelRegistry when ctx has no registry", async () => {
		const r = await resolveSummarizer({});
		expect(r).toEqual({ ok: false, tried: ["no-modelRegistry"] });
	});

	it("skips missing candidates and returns the first usable model", async () => {
		const find = vi.fn((provider: string, id: string) => (id === "claude-haiku-4-5" ? fakeModel : undefined));
		const getApiKeyAndHeaders = vi.fn(async () => ({ ok: true, apiKey: "key", headers: { x: "1" } }));
		const r = await resolveSummarizer(
			{ modelRegistry: { find, getApiKeyAndHeaders } },
			[
				{ provider: "p", id: "missing" },
				{ provider: "anthropic", id: "claude-haiku-4-5" },
			],
		);
		expect(r.ok).toBe(true);
		if (r.ok) {
			expect(r.resolution.label).toBe("anthropic/claude-haiku-4-5");
			expect(r.resolution.apiKey).toBe("key");
			expect(r.resolution.headers).toEqual({ x: "1" });
		}
		expect(find).toHaveBeenCalledTimes(2);
	});

	it("accepts subscription auth where apiKey is empty but headers carry the bearer", async () => {
		const find = vi.fn(() => fakeModel);
		const getApiKeyAndHeaders = vi.fn(async () => ({ ok: true, apiKey: undefined, headers: { Authorization: "Bearer x" } }));
		const r = await resolveSummarizer({ modelRegistry: { find, getApiKeyAndHeaders } }, [{ provider: "anthropic", id: "claude-haiku-4-5" }]);
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.resolution.headers).toEqual({ Authorization: "Bearer x" });
	});

	it("records auth-fail and err: for unusable candidates and finally returns ok=false", async () => {
		const find = vi.fn(() => fakeModel);
		let call = 0;
		const getApiKeyAndHeaders = vi.fn(async () => {
			call += 1;
			if (call === 1) return { ok: false };
			throw new Error("boom-with-a-very-long-message-that-will-be-truncated-to-stay-readable");
		});
		const r = await resolveSummarizer(
			{ modelRegistry: { find, getApiKeyAndHeaders } },
			[
				{ provider: "a", id: "1" },
				{ provider: "b", id: "2" },
			],
		);
		expect(r).toEqual({
			ok: false,
			tried: ["a/1=auth-fail", expect.stringMatching(/^b\/2=err:boom-/)],
		});
	});

	it("falls through to ok=false with empty tried when given no candidates", async () => {
		const r = await resolveSummarizer(
			{ modelRegistry: { find: () => undefined, getApiKeyAndHeaders: async () => ({ ok: true, apiKey: "k" }) } },
			[],
		);
		expect(r).toEqual({ ok: false, tried: [] });
	});

	it("uses the default candidate list when none is supplied", async () => {
		const find = vi.fn(() => undefined);
		const r = await resolveSummarizer({ modelRegistry: { find, getApiKeyAndHeaders: async () => ({ ok: true, apiKey: "k" }) } });
		expect(find).toHaveBeenCalledTimes(DEFAULT_SUMMARIZER_CANDIDATES.length);
		expect(r.ok).toBe(false);
	});

	it("captures non-Error throwables when reading auth", async () => {
		const find = vi.fn(() => fakeModel);
		const getApiKeyAndHeaders = vi.fn(async () => {
			// eslint-disable-next-line no-throw-literal
			throw "string-error";
		});
		const r = await resolveSummarizer({ modelRegistry: { find, getApiKeyAndHeaders } }, [{ provider: "x", id: "y" }]);
		expect(r).toEqual({ ok: false, tried: ["x/y=err:string-error"] });
	});
});

describe("generateLiveSummary", () => {
	const resolution = { model: fakeModel, apiKey: "key", headers: undefined, label: "anthropic/claude-haiku-4-5" };

	beforeEach(() => completeSimple.mockReset());

	it("rejects empty activity without calling the model", async () => {
		const r = await generateLiveSummary({ resolution, activity: "  \n " });
		expect(r).toEqual({ ok: false, reason: "empty activity" });
		expect(completeSimple).not.toHaveBeenCalled();
	});

	it("returns the trimmed summary on success", async () => {
		completeSimple.mockResolvedValueOnce({ stopReason: "stop", content: [{ type: "text", text: '"🔧 PR 트래커 작성".\n설명' }] });
		const r = await generateLiveSummary({ resolution, activity: "doing things" });
		expect(r).toEqual({ ok: true, summary: "🔧 PR 트래커 작성" });
	});

	it("returns failure when stopReason is not stop", async () => {
		completeSimple.mockResolvedValueOnce({ stopReason: "length", content: [{ type: "text", text: "trunc" }] });
		const r = await generateLiveSummary({ resolution, activity: "x" });
		expect(r).toEqual({ ok: false, reason: "stopReason=length" });
	});

	it("returns failure when completeSimple throws", async () => {
		completeSimple.mockRejectedValueOnce(new Error("boom"));
		const r = await generateLiveSummary({ resolution, activity: "x" });
		expect(r).toEqual({ ok: false, reason: "complete: boom" });
	});

	it("captures non-Error throwables from completeSimple", async () => {
		// eslint-disable-next-line prefer-promise-reject-errors
		completeSimple.mockReturnValueOnce(Promise.reject("nope"));
		const r = await generateLiveSummary({ resolution, activity: "x" });
		expect(r).toEqual({ ok: false, reason: "complete: nope" });
	});

	it("returns failure when content has no text", async () => {
		completeSimple.mockResolvedValueOnce({ stopReason: "stop", content: [{ type: "image" }, null] });
		const r = await generateLiveSummary({ resolution, activity: "x" });
		expect(r).toEqual({ ok: false, reason: "empty summary" });
	});

	it("returns failure when text blocks are missing the text field", async () => {
		completeSimple.mockResolvedValueOnce({ stopReason: "stop", content: [{ type: "text" }, { type: "text", text: 0 }] });
		const r = await generateLiveSummary({ resolution, activity: "x" });
		expect(r).toEqual({ ok: false, reason: "empty summary" });
	});

	it("returns failure when content is missing entirely", async () => {
		completeSimple.mockResolvedValueOnce({ stopReason: "stop" });
		const r = await generateLiveSummary({ resolution, activity: "x" });
		expect(r).toEqual({ ok: false, reason: "empty summary" });
	});

	it("truncates long error messages to 80 chars", async () => {
		const longMsg = "x".repeat(200);
		completeSimple.mockRejectedValueOnce(new Error(longMsg));
		const r = await generateLiveSummary({ resolution, activity: "x" });
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.reason.length).toBeLessThanOrEqual("complete: ".length + 80);
	});
});
