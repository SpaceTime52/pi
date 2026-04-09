import { AuthStorage, ModelRegistry } from "@mariozechner/pi-coding-agent";
import type { Ctx } from "../src/core/types.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

vi.mock("../src/runtime/handlers.js", () => ({ runHandlers: vi.fn(async () => []) }));

const makeTempTree = () => mkdtemp(join(tmpdir(), "claude-code-bridge-agent-test-"));

afterEach(async () => {
	const { clearSessionState } = await import("../src/runtime/store.js");
	clearSessionState();
	vi.clearAllMocks();
});

function makeCtx(cwd: string): Ctx {
	const modelRegistry = ModelRegistry.inMemory(AuthStorage.inMemory());
	return {
		cwd,
		hasUI: false,
		ui: { confirm: async () => false, notify() {} },
		sessionManager: { getSessionFile: () => undefined },
		modelRegistry,
		model: undefined,
	};
}

describe("claude bridge assistant cache", () => {
	it("passes cached last assistant message from message_end into the Stop hook input", async () => {
		const root = await makeTempTree();
		await mkdir(join(root, ".claude"), { recursive: true });
		await writeFile(join(root, ".claude", "CLAUDE.md"), "bridge enabled", "utf8");
		const ctx = makeCtx(root);
		const pi = { sendUserMessage: vi.fn() };
		const { refreshState } = await import("../src/runtime/store.js");
		const { createAgentEndHandler, createAssistantMessageEndHandler } = await import("../src/runtime/agent.js");
		const { runHandlers } = await import("../src/runtime/handlers.js");
		await refreshState(ctx);
		await createAssistantMessageEndHandler()({ message: { role: "assistant", content: [{ type: "text", text: "cached reply" }] } });
		await createAgentEndHandler(pi)({ messages: [] }, ctx);
		expect(vi.mocked(runHandlers)).toHaveBeenCalledWith(
			expect.anything(),
			"Stop",
			undefined,
			expect.objectContaining({ last_assistant_message: "cached reply" }),
			ctx,
		);
	});
});
