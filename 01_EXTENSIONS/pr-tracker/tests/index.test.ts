import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";
import extension from "../src/index.ts";
import { EXTENSION_ID } from "../src/types.ts";

type Handler = (event: any, ctx: ExtensionContext) => Promise<void> | void;

const rawPr = {
	number: 63,
	url: "https://github.com/acme/web/pull/63",
	title: "Add PR tracker",
	state: "OPEN",
	isDraft: false,
	mergeable: "MERGEABLE",
	mergeStateStatus: "CLEAN",
	reviewDecision: "APPROVED",
	changedFiles: 1,
	statusCheckRollup: [{ status: "COMPLETED", conclusion: "SUCCESS" }],
};

function createApi() {
	const handlers = new Map<string, Handler>();
	const commands = new Map<string, any>();
	const exec = vi.fn(async () => ({ stdout: JSON.stringify(rawPr), code: 0 }));
	const appendEntry = vi.fn();
	const api = {
		on(eventName: string, handler: Handler) {
			handlers.set(eventName, handler);
		},
		registerCommand(name: string, options: any) {
			commands.set(name, options);
		},
		exec,
		appendEntry,
	} as unknown as ExtensionAPI;
	return { api, handlers, commands, exec, appendEntry };
}

function createContext() {
	return {
		cwd: "/repo",
		hasUI: true,
		ui: { notify: vi.fn(), setWidget: vi.fn(), setStatus: vi.fn(), select: vi.fn(), confirm: vi.fn() },
		sessionManager: { getBranch: () => [] },
	} as unknown as ExtensionContext;
}

describe("pr-tracker extension", () => {
	it("registers session/tool handlers and the /pr command", () => {
		const { api, handlers, commands } = createApi();
		extension(api);
		expect(handlers.has("session_start")).toBe(true);
		expect(handlers.has("tool_result")).toBe(true);
		expect(commands.get("pr")?.description).toContain("pull request");
	});

	it("auto-tracks successful gh pr create output", async () => {
		const { api, handlers, exec, appendEntry } = createApi();
		extension(api);
		const ctx = createContext();
		await handlers.get("tool_result")?.(
			{
				toolName: "bash",
				isError: false,
				input: { command: "gh pr create --fill" },
				content: [{ type: "text", text: "https://github.com/acme/web/pull/63" }],
			},
			ctx,
		);

		expect(exec).toHaveBeenCalledWith("gh", ["pr", "view", "https://github.com/acme/web/pull/63", "--json", expect.any(String)], {
			cwd: "/repo",
			signal: undefined,
			timeout: 15000,
		});
		expect(appendEntry).toHaveBeenCalledWith(
			EXTENSION_ID,
			expect.objectContaining({ kind: "state", state: expect.objectContaining({ trackedRef: rawPr.url }) }),
		);
		expect(ctx.ui.setWidget).toHaveBeenCalledWith(EXTENSION_ID, expect.arrayContaining([expect.stringContaining("#63 Ready to merge")]));
		expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining("Tracking #63 Ready to merge"), "info");
	});

	it("/pr untrack clears state", async () => {
		const { api, commands, appendEntry } = createApi();
		extension(api);
		const ctx = createContext() as any;
		await commands.get("pr").handler("untrack", ctx);
		expect(appendEntry).toHaveBeenCalledWith(EXTENSION_ID, { version: 1, kind: "state", state: {} });
		expect(ctx.ui.setWidget).toHaveBeenCalledWith(EXTENSION_ID, undefined);
	});
});
