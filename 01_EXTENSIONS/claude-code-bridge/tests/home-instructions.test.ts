import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadState } from "../src/test-api.js";

const originalHome = process.env.HOME;
const makeTempTree = () => mkdtemp(join(tmpdir(), "claude-code-bridge-home-test-"));

afterEach(() => {
	if (originalHome === undefined) delete process.env.HOME;
	else process.env.HOME = originalHome;
	vi.restoreAllMocks();
});

describe("claude bridge HOME instruction boundaries", () => {
	it("does not treat the home ~/.claude settings directory as the project root", async () => {
		const root = await makeTempTree();
		const home = join(root, "home");
		const cwd = join(home, "Desktop", "scratch");
		process.env.HOME = home;
		await mkdir(join(home, ".claude"), { recursive: true });
		await mkdir(cwd, { recursive: true });
		await writeFile(join(home, ".claude", "settings.json"), JSON.stringify({ env: { USER_ONLY: "yes" } }), "utf8");
		const state = await loadState(cwd);
		expect(state.projectRoot).toBe(cwd);
		expect(state.settingsFiles).toEqual([join(home, ".claude", "settings.json")]);
		expect(state.mergedEnv).toEqual({ USER_ONLY: "yes" });
	});

	it("stops ancestor project lookup at the HOME boundary for symlinked HOME aliases", async () => {
		const root = await makeTempTree();
		const outer = join(root, "outer");
		const home = join(outer, "home-real");
		const homeAlias = join(root, "home-link");
		const cwd = join(homeAlias, "Desktop", "scratch");
		process.env.HOME = home;
		await mkdir(join(home, ".claude"), { recursive: true });
		await symlink(home, homeAlias, "dir");
		await mkdir(cwd, { recursive: true });
		await writeFile(join(outer, "CLAUDE.md"), "outer instructions", "utf8");
		await writeFile(join(home, ".claude", "settings.json"), JSON.stringify({ env: { USER_ONLY: "yes" } }), "utf8");
		const state = await loadState(cwd);
		expect(state.projectRoot).toBe(cwd);
		expect(state.unconditionalPromptText).not.toContain("outer instructions");
		expect(state.mergedEnv).toEqual({ USER_ONLY: "yes" });
	});

	it("still loads project instructions when HOME is an actual git project root", async () => {
		const root = await makeTempTree();
		const home = join(root, "home");
		process.env.HOME = home;
		await mkdir(join(home, ".git"), { recursive: true });
		await writeFile(join(home, "CLAUDE.md"), "home project instructions", "utf8");
		const state = await loadState(home);
		expect(state.projectRoot).toBe(home);
		expect(state.unconditionalPromptText).toContain("home project instructions");
	});

	it("dedupes HOME instruction files when a HOME git root is entered through a symlink alias", async () => {
		const root = await makeTempTree();
		const home = join(root, "home-real");
		const homeAlias = join(root, "home-link");
		process.env.HOME = home;
		await mkdir(join(home, ".git"), { recursive: true });
		await mkdir(join(home, ".claude", "rules"), { recursive: true });
		await symlink(home, homeAlias, "dir");
		await writeFile(join(home, ".claude", "CLAUDE.md"), "shared home guidance", "utf8");
		await writeFile(join(home, ".claude", "rules", "rule.md"), "rule text", "utf8");
		const state = await loadState(homeAlias);
		expect(state.instructionFiles).toEqual([join(home, ".claude", "CLAUDE.md"), join(home, ".claude", "rules", "rule.md")]);
		expect(state.unconditionalPromptText.match(/shared home guidance/g)?.length).toBe(1);
		expect(state.unconditionalPromptText.match(/rule text/g)?.length).toBe(1);
	});
});
