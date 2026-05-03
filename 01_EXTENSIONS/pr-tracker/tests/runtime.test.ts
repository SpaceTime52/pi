import { describe, expect, it, vi } from "vitest";
import extension from "../src/index.ts";
import { EXTENSION_ID, type PrCommandOptions, type PrTrackerPi, type ToolResultLike, type TrackerContext } from "../src/types.ts";
import { createContext, rawPr, trackedState } from "./helpers.ts";

type Handler = (event: ToolResultLike, ctx: TrackerContext) => Promise<void> | void;

function createApi(execResult = { stdout: JSON.stringify(rawPr), code: 0 }) {
	const handlers = new Map<string, Handler>();
	const commands = new Map<string, PrCommandOptions>();
	const exec = vi.fn(async () => execResult);
	const appendEntry = vi.fn();
	const api: PrTrackerPi = {
		exec,
		appendEntry,
		on(eventName, handler) { handlers.set(eventName, handler); },
		registerCommand(name, options) { commands.set(name, options); },
	};
	extension(api);
	return { handlers, commands, exec, appendEntry };
}

describe("runtime", () => {
	it("exposes command completions and command state access", async () => {
		const { commands } = createApi();
		expect(commands.get("pr")?.getArgumentCompletions("re")).toEqual([{ value: "refresh", label: "refresh" }]);
		await commands.get("pr")?.handler("show", createContext());
	});

	it("reconstructs session state and refreshes tracked PRs", async () => {
		const { handlers, exec } = createApi();
		const ctx = createContext();
		ctx.sessionManager.getBranch = () => [{ type: "custom", customType: EXTENSION_ID, data: { version: 1, kind: "state", state: trackedState() } }];
		await handlers.get("session_start")?.({ toolName: "session" }, ctx);
		await Promise.resolve();
		expect(ctx.ui.setWidget).toHaveBeenCalledWith(EXTENSION_ID, expect.arrayContaining([expect.stringContaining("#63")]));
		expect(exec).toHaveBeenCalledWith("gh", ["pr", "view", rawPr.url, "--json", expect.any(String)], expect.objectContaining({ cwd: "/repo" }));
	});

	it("ignores unrelated tool results", async () => {
		const { handlers, exec } = createApi();
		const ctx = createContext();
		await handlers.get("tool_result")?.({ toolName: "read", input: { command: "gh pr create" } }, ctx);
		await handlers.get("tool_result")?.({ toolName: "bash", isError: true, input: { command: "gh pr create" } }, ctx);
		await handlers.get("tool_result")?.({ toolName: "bash", input: { command: "git status" } }, ctx);
		expect(exec).not.toHaveBeenCalled();
	});

	it("persists and notifies refresh failures", async () => {
		const { commands, appendEntry } = createApi({ stdout: "", stderr: "missing", code: 1 });
		const ctx = createContext();
		await commands.get("pr")?.handler("track 63", ctx);
		expect(appendEntry).toHaveBeenCalledWith(EXTENSION_ID, expect.objectContaining({ state: expect.objectContaining({ lastError: "missing" }) }));
		expect(ctx.ui.notify).toHaveBeenCalledWith("PR refresh failed: missing", "error");
	});
});
