import { describe, expect, it } from "vitest";
import { SUBAGENT_SESSION_DIR } from "../src/session-path.ts";
import { getSessionTitle, shouldAutoNameSession, shouldReplaceSessionTitle } from "../src/session-title-state.ts";
import { createApiMock, createContext } from "./helpers.ts";

describe("session title state", () => {
	it("prefers the live session title and restores persisted names", () => {
		const liveApi = createApiMock("Live title");
		expect(getSessionTitle(liveApi.api, createContext({}).ctx)).toBe("Live title");
		const restoredApi = createApiMock();
		expect(getSessionTitle(restoredApi.api, createContext({ sessionName: "Restored title" }).ctx)).toBe("Restored title");
	});

	it("handles missing or failing session-manager lookups", () => {
		const api = createApiMock();
		expect(getSessionTitle(api.api, createContext({ throwOnGetSessionName: true }).ctx)).toBeUndefined();
		expect(getSessionTitle(api.api, { ...createContext({}).ctx, sessionManager: { getSessionFile: () => "/tmp/a.jsonl", getSessionName: () => undefined } })).toBeUndefined();
		expect(getSessionTitle(api.api, { ...createContext({}).ctx, sessionManager: { getSessionFile: () => "/tmp/a.jsonl" } })).toBeUndefined();
	});

	it("detects replaceable prompt-copy titles", () => {
		const prompt = "pi에서 ollama glm-5.1 쓰려면 어떻게 해야함";
		expect(shouldReplaceSessionTitle(undefined, prompt)).toBe(true);
		expect(shouldReplaceSessionTitle(prompt, prompt)).toBe(true);
		expect(shouldReplaceSessionTitle("Existing title", "   ")).toBe(false);
		expect(shouldReplaceSessionTitle("Ollama GLM-5.1 사용 방법", prompt)).toBe(false);
	});

	it("decides when auto naming should run", () => {
		const prompt = "pi에서 ollama glm-5.1 쓰려면 어떻게 해야함";
		const api = createApiMock();
		expect(shouldAutoNameSession(api.api, createContext({ sessionName: "Already named" }).ctx, "prompt", false)).toBe(false);
		expect(shouldAutoNameSession(createApiMock(prompt).api, createContext({}).ctx, prompt, false)).toBe(true);
		expect(shouldAutoNameSession(api.api, createContext({}).ctx, "   ", false)).toBe(false);
		expect(shouldAutoNameSession(api.api, createContext({ sessionFile: `${SUBAGENT_SESSION_DIR}/child/a.jsonl` }).ctx, "prompt", false)).toBe(false);
		expect(shouldAutoNameSession(api.api, createContext({}).ctx, "prompt", true)).toBe(false);
		expect(shouldAutoNameSession(api.api, createContext({}).ctx, "prompt", false)).toBe(true);
	});
});
