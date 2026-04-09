import { afterEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AuthStorage, ModelRegistry } from "@mariozechner/pi-coding-agent";
import type { Ctx } from "../src/core/types.js";
import { clearSessionState, ensureState, markStateDirty } from "../src/runtime/store.js";

const originalHome = process.env.HOME;
const makeTempTree = () => mkdtemp(join(tmpdir(), "claude-code-bridge-state-test-"));

afterEach(() => {
	clearSessionState();
	if (originalHome === undefined) delete process.env.HOME;
	else process.env.HOME = originalHome;
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

describe("claude bridge state cache", () => {
	it("reuses cached state until marked dirty", async () => {
		const root = await makeTempTree();
		const home = join(root, "home");
		const repo = join(root, "repo");
		process.env.HOME = home;
		await mkdir(home, { recursive: true });
		await mkdir(repo, { recursive: true });
		await writeFile(join(repo, "CLAUDE.md"), "Version one", "utf8");

		const ctx = makeCtx(repo);
		const first = await ensureState(ctx);
		expect(first.unconditionalPromptText).toContain("Version one");

		await writeFile(join(repo, "CLAUDE.md"), "Version two", "utf8");
		const cached = await ensureState(ctx);
		expect(cached.unconditionalPromptText).toContain("Version one");

		markStateDirty();
		const refreshed = await ensureState(ctx);
		expect(refreshed.unconditionalPromptText).toContain("Version two");
	});
});
