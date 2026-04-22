import { describe, expect, it } from "vitest";
import { SUBAGENT_SESSION_DIR } from "../src/session-path.ts";
import { getSessionTitle, shouldAutoNameSession } from "../src/session-title-state.ts";
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

	it("decides when auto naming should run", () => {
		const api = createApiMock();
		expect(shouldAutoNameSession(api.api, createContext({ sessionName: "Already named" }).ctx, "prompt", false)).toBe(false);
		expect(shouldAutoNameSession(api.api, createContext({}).ctx, "   ", false)).toBe(false);
		expect(shouldAutoNameSession(api.api, createContext({ sessionFile: `${SUBAGENT_SESSION_DIR}/child/a.jsonl` }).ctx, "prompt", false)).toBe(false);
		expect(shouldAutoNameSession(api.api, createContext({}).ctx, "prompt", true)).toBe(false);
		expect(shouldAutoNameSession(api.api, createContext({}).ctx, "prompt", false)).toBe(true);
	});
});
