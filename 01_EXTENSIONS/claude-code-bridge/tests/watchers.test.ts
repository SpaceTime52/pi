import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { classifyConfigSource, diffSnapshots, extractFileWatchBasenames } from "../src/test-api.js";
import { scanConfigSnapshot, scanFileSnapshot } from "../src/runtime/watch-scan.js";

const makeTempTree = () => mkdtemp(join(tmpdir(), "claude-code-bridge-watch-test-"));

describe("claude bridge watcher helpers", () => {
	it("classifies config change sources", () => {
		expect(classifyConfigSource("/Users/me/.claude/settings.json")).toBe("user_settings");
		expect(classifyConfigSource("/Users/me/.claude/settings.local.json")).toBe("user_settings");
		expect(classifyConfigSource("/repo/.claude/settings.json")).toBe("project_settings");
		expect(classifyConfigSource("/repo/.claude/settings.local.json")).toBe("local_settings");
		expect(classifyConfigSource("/repo/.claude/skills/review.md")).toBe("skills");
	});

	it("detects add, change, and unlink transitions", () => {
		const before = new Map([["/a", "1"], ["/b", "1"]]);
		const after = new Map([["/a", "2"], ["/c", "1"]]);
		expect(diffSnapshots(before, after)).toEqual([{ path: "/a", event: "change" }, { path: "/b", event: "unlink" }, { path: "/c", event: "add" }]);
	});

	it("falls back to wildcard file watching for regex matchers", () => {
		const hooks = [{ matcher: ".env|.envrc" }, { matcher: "config-.*" }];
		expect(extractFileWatchBasenames(hooks)).toEqual([".env", ".envrc", "*"]);
	});

	it("does not recurse through HOME when cwd is a symlinked HOME alias", async () => {
		const root = await makeTempTree();
		const home = join(root, "home-real");
		const homeAlias = join(root, "home-link");
		process.env.HOME = home;
		await mkdir(join(home, ".claude"), { recursive: true });
		await mkdir(join(home, "nested-repo", ".claude", "skills"), { recursive: true });
		await symlink(home, homeAlias, "dir");
		await writeFile(join(home, ".claude", "settings.json"), JSON.stringify({}), "utf8");
		await writeFile(join(home, "nested-repo", ".claude", "skills", "review.md"), "nested rule", "utf8");

		const snapshot = scanConfigSnapshot(homeAlias);

		expect(Array.from(snapshot.keys())).toContain(join(home, ".claude", "settings.json"));
		expect(Array.from(snapshot.keys())).not.toContain(join(homeAlias, "nested-repo", ".claude", "skills", "review.md"));
		expect(Array.from(snapshot.keys())).not.toContain(join(home, "nested-repo", ".claude", "skills", "review.md"));
	});

	it("does not recursively watch HOME files unless HOME is an actual git project root", async () => {
		const root = await makeTempTree();
		const home = join(root, "home-real");
		process.env.HOME = home;
		await mkdir(join(home, "nested"), { recursive: true });
		await writeFile(join(home, "nested", "tracked.env"), "x=1", "utf8");

		expect(Array.from(scanFileSnapshot(home, ["*"], []).keys())).toEqual([]);

		await mkdir(join(home, ".git"), { recursive: true });
		expect(Array.from(scanFileSnapshot(home, ["*"], []).keys())).toContain(join(home, "nested", "tracked.env"));
	});
});
