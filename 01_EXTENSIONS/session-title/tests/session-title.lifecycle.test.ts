import { describe, expect, it } from "vitest";
import extension from "../src/session-title.ts";
import { createApiMock, createContext } from "./helpers.ts";

describe("session-title lifecycle", () => {
	it("syncs on tree and agent end, then clears on shutdown", async () => {
		const api = createApiMock("Release prep");
		extension(api.api);
		const sessionTree = api.getHandler("session_tree");
		const agentEnd = api.getHandler("agent_end");
		const sessionShutdown = api.getHandler("session_shutdown");
		if (!sessionTree || !agentEnd || !sessionShutdown) throw new Error("missing lifecycle handlers");
		const { ctx, setStatus, setTitle } = createContext({});
		await sessionTree({}, ctx);
		await agentEnd({}, ctx);
		await sessionShutdown({}, ctx);
		expect(setStatus).toHaveBeenCalledWith("session-title", "Release prep");
		expect(setTitle).toHaveBeenLastCalledWith("π - pi-project");
	});
});
