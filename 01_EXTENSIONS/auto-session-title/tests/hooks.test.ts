import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBeforeAgentStartHandler, createInputHandler, createSessionShutdownHandler } from "../src/hooks.js";
import { makeInput, stubContext } from "./helpers.js";

const { resolveSessionTitle } = vi.hoisted(() => ({ resolveSessionTitle: vi.fn() }));
vi.mock("../src/summarize.js", async () => ({ ...(await vi.importActual("../src/summarize.js")), resolveSessionTitle }));

describe("hooks", () => {
	beforeEach(() => resolveSessionTitle.mockReset());

	it("shares pending input between input and before_agent_start handlers", async () => {
		resolveSessionTitle.mockResolvedValue("Summarized title");
		const getSessionName = vi.fn(() => undefined);
		const setSessionName = vi.fn();
		await createInputHandler(getSessionName, setSessionName)(makeInput("raw prompt"), stubContext());
		await createBeforeAgentStartHandler(getSessionName, setSessionName)({}, stubContext());
		expect(setSessionName).toHaveBeenCalledWith("Summarized title");
	});

	it("clears pending input on session shutdown", async () => {
		resolveSessionTitle.mockResolvedValue("Summarized title");
		const getSessionName = vi.fn(() => undefined);
		const setSessionName = vi.fn();
		const ctx = stubContext();
		await createInputHandler(getSessionName, setSessionName)(makeInput("raw prompt"), ctx);
		await createSessionShutdownHandler()({}, ctx);
		await createBeforeAgentStartHandler(getSessionName, setSessionName)({}, ctx);
		expect(setSessionName).not.toHaveBeenCalled();
	});
});
