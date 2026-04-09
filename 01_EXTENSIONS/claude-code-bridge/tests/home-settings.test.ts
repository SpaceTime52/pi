import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectSettings } from "../src/test-api.js";

const originalHome = process.env.HOME;
const makeTempTree = () => mkdtemp(join(tmpdir(), "claude-code-bridge-home-settings-test-"));

afterEach(() => {
	if (originalHome === undefined) delete process.env.HOME;
	else process.env.HOME = originalHome;
	vi.restoreAllMocks();
});

describe("claude bridge HOME settings boundaries", () => {
	it("does not treat HOME as project/local settings scope, even via symlinked cwd", async () => {
		const root = await makeTempTree();
		const home = join(root, "home-real");
		const homeAlias = join(root, "home-link");
		process.env.HOME = home;
		await mkdir(join(home, ".claude"), { recursive: true });
		await symlink(home, homeAlias, "dir");
		await writeFile(join(home, ".claude", "settings.local.json"), JSON.stringify({ allowedHttpHookUrls: ["https://hooks.example.com/*"] }), "utf8");
		const settings = collectSettings(homeAlias);
		expect(settings.allowedHttpHookUrls).toEqual(["https://hooks.example.com/*"]);
		expect(settings.settingsFiles).toEqual([join(home, ".claude", "settings.local.json")]);
		expect(settings.warnings).toEqual([]);
	});

	it("dedupes HOME git-root settings when cwd enters through a HOME symlink alias", async () => {
		const root = await makeTempTree();
		const home = join(root, "home-real");
		const homeAlias = join(root, "home-link");
		process.env.HOME = home;
		await mkdir(join(home, ".git"), { recursive: true });
		await mkdir(join(home, ".claude"), { recursive: true });
		await symlink(home, homeAlias, "dir");
		await writeFile(join(home, ".claude", "settings.json"), JSON.stringify({ env: { USER_ONLY: "yes" } }), "utf8");
		const settings = collectSettings(homeAlias);
		expect(settings.settingsFiles).toEqual([join(home, ".claude", "settings.json")]);
		expect(settings.warnings).toEqual([]);
	});
});
