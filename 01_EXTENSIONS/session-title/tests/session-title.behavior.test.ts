import { beforeEach, describe, expect, it, vi } from "vitest";
import * as generator from "../src/title-generator.ts";
import extension from "../src/session-title.ts";
import { createApiMock, createContext } from "./helpers.ts";

describe("session-title behavior", () => {
	beforeEach(() => vi.restoreAllMocks());

	it("auto-names and syncs the terminal title in the background", async () => {
		vi.spyOn(generator, "generateSessionTitle").mockResolvedValue("Add session title extension");
		const api = createApiMock();
		extension(api.api);
		const beforeAgentStart = api.getHandler("before_agent_start");
		if (!beforeAgentStart) throw new Error("missing before_agent_start handler");
		const { ctx, setStatus, setTitle } = createContext({});
		expect(beforeAgentStart({ prompt: "Please add terminal title sync." }, ctx)).toBeUndefined();
		await vi.waitFor(() => expect(api.getSessionName()).toBe("Add session title extension"));
		expect(setStatus).not.toHaveBeenCalled();
		expect(setTitle).toHaveBeenLastCalledWith("π - Add session title extension - pi-project");
	});

	it("replaces prompt-copy titles with a summarized title", async () => {
		const prompt = "pi에서 ollama glm-5.1 쓰려면 어떻게 해야함";
		vi.spyOn(generator, "generateSessionTitle").mockResolvedValue("Ollama GLM-5.1 사용 방법");
		const api = createApiMock(prompt);
		extension(api.api);
		const beforeAgentStart = api.getHandler("before_agent_start");
		if (!beforeAgentStart) throw new Error("missing before_agent_start handler");
		const { ctx, setStatus, setTitle } = createContext({});
		beforeAgentStart({ prompt }, ctx);
		await vi.waitFor(() => expect(api.getSessionName()).toBe("Ollama GLM-5.1 사용 방법"));
		expect(setStatus).not.toHaveBeenCalled();
		expect(setTitle).toHaveBeenLastCalledWith("π - Ollama GLM-5.1 사용 방법 - pi-project");
	});

	it("skips naming when it should not run and keeps existing titles", async () => {
		const spy = vi.spyOn(generator, "generateSessionTitle").mockResolvedValue("ignored");
		const api = createApiMock("Existing title");
		extension(api.api);
		const beforeAgentStart = api.getHandler("before_agent_start");
		if (!beforeAgentStart) throw new Error("missing before_agent_start handler");
		beforeAgentStart({ prompt: "Please add terminal title sync." }, createContext({}).ctx);
		api.setSessionName("");
		beforeAgentStart({ prompt: "   " }, createContext({}).ctx);
		beforeAgentStart({ prompt: "Please add terminal title sync." }, createContext({ sessionFile: "/Users/me/.pi/agent/sessions/subagents/child/a.jsonl" }).ctx);
		await Promise.resolve();
		expect(spy).not.toHaveBeenCalled();
	});

	it("does not wait for async naming before the turn starts", async () => {
		const gate = Promise.withResolvers<string>();
		vi.spyOn(generator, "generateSessionTitle").mockReturnValue(gate.promise);
		const api = createApiMock();
		extension(api.api);
		const beforeAgentStart = api.getHandler("before_agent_start");
		if (!beforeAgentStart) throw new Error("missing before_agent_start handler");
		const result = beforeAgentStart({ prompt: "Please add terminal title sync." }, createContext({}).ctx);
		expect(result).toBeUndefined();
		await Promise.resolve();
		expect(api.getSessionName()).toBe("");
		gate.resolve("Generated title");
		await vi.waitFor(() => expect(api.getSessionName()).toBe("Generated title"));
	});
});
