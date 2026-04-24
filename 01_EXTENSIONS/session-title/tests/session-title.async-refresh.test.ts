import { beforeEach, describe, expect, it, vi } from "vitest";
import * as generator from "../src/title-generator.ts";
import extension from "../src/session-title.ts";
import { createApiMock, createContext } from "./helpers.ts";

describe("session-title async refresh", () => {
	beforeEach(() => vi.restoreAllMocks());

	it("does not overwrite a name restored during background generation", async () => {
		const gate = Promise.withResolvers<string>();
		vi.spyOn(generator, "generateSessionTitle").mockReturnValue(gate.promise);
		const api = createApiMock();
		extension(api.api);
		const beforeAgentStart = api.getHandler("before_agent_start");
		if (!beforeAgentStart) throw new Error("missing before_agent_start handler");
		let restoredName = "";
		const { ctx, setTitle } = createContext({ sessionName: "" });
		ctx.sessionManager.getSessionName = () => restoredName;
		beforeAgentStart({ prompt: "Please add terminal title sync." }, ctx);
		restoredName = "Restored later";
		gate.resolve("Generated title");
		await vi.waitFor(() => expect(setTitle).toHaveBeenLastCalledWith("π - Restored later - pi-project"));
		expect(api.getSessionName()).toBe("");
		expect(ctx.sessionManager.getSessionName()).toBe("Restored later");
	});

	it("generates titles from the first user prompt only", async () => {
		const spy = vi.spyOn(generator, "generateSessionTitle").mockResolvedValue("first prompt title");
		const api = createApiMock();
		extension(api.api);
		const beforeAgentStart = api.getHandler("before_agent_start");
		const agentEnd = api.getHandler("agent_end");
		if (!beforeAgentStart || !agentEnd) throw new Error("missing handlers");
		const { ctx } = createContext({
			branchEntries: [
				{ type: "message", message: { role: "user", content: "Please add a session title extension." } },
				{ type: "message", message: { role: "assistant", content: "Implemented the first pass." } },
				{ type: "message", message: { role: "user", content: "Also update it asynchronously with more context." } },
			],
		});
		beforeAgentStart({ prompt: "A later prompt should not drive the title." }, ctx);
		await vi.waitFor(() => expect(api.getSessionName()).toBe("first prompt title"));
		await agentEnd({}, ctx);
		expect(spy).toHaveBeenCalledTimes(1);
		expect(spy).toHaveBeenCalledWith(ctx, "Please add a session title extension.");
	});

	it("does not overwrite a manual title during later refreshes", async () => {
		const spy = vi.spyOn(generator, "generateSessionTitle").mockResolvedValue("session-title async refresh");
		const api = createApiMock("Manual title");
		extension(api.api);
		const agentEnd = api.getHandler("agent_end");
		if (!agentEnd) throw new Error("missing agent_end handler");
		await agentEnd({}, createContext({ branchEntries: [{ type: "message", message: { role: "user", content: "Hide branch names too." } }] }).ctx);
		expect(api.getSessionName()).toBe("Manual title");
		expect(spy).not.toHaveBeenCalled();
	});
});
