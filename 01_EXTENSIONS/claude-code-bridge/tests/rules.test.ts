import { afterEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { activateConditionalRules, matchesAnyGlob, parseFrontmatter } from "../src/test-api.js";

const makeTempTree = () => mkdtemp(join(tmpdir(), "claude-code-bridge-rules-test-"));
const originalHome = process.env.HOME;

afterEach(() => {
	if (originalHome === undefined) delete process.env.HOME;
	else process.env.HOME = originalHome;
});

describe("claude bridge rules", () => {
	it("matches brace and doublestar globs", () => {
		expect(matchesAnyGlob("/tmp/repo", "/tmp/repo/src/api/users/list.ts", ["src/{api,web}/**/*.ts"])).toBe(true);
		expect(matchesAnyGlob("/tmp/repo", "/tmp/repo/src/other/file.ts", ["src/{api,web}/**/*.ts"])).toBe(false);
	});

	it("only treats paths: frontmatter as path globs", () => {
		const parsed = parseFrontmatter(["---", "description: demo", "tags:", "  - backend", "paths:", "  - src/**/*.ts", "---", "body"].join("\n"));
		expect(parsed.paths).toEqual(["src/**/*.ts"]);
	});

	it("activates matching path-scoped rules only once", () => {
		const rule = { id: "rule-1", path: "/tmp/repo/.claude/rules/api.md", scope: "project" as const, kind: "rule" as const, ownerRoot: "/tmp/repo", content: "api rules", conditionalGlobs: ["src/api/**/*.ts"] };
		const state = { conditionalRules: [rule], activeConditionalRuleIds: new Set<string>() };
		const first = activateConditionalRules(state, ["/tmp/repo/src/api/users/list.ts"]);
		const second = activateConditionalRules(state, ["/tmp/repo/src/api/users/list.ts"]);
		expect(first).toHaveLength(1);
		expect(first[0]?.id).toBe("rule-1");
		expect(second).toHaveLength(0);
		expect(state.activeConditionalRuleIds.has("rule-1")).toBe(true);
	});

	it("matches symlinked HOME-alias paths against real HOME-owned conditional globs", async () => {
		const root = await makeTempTree();
		const home = join(root, "home-real");
		const homeAlias = join(root, "home-link");
		process.env.HOME = home;
		await mkdir(join(home, "src"), { recursive: true });
		await symlink(home, homeAlias, "dir");
		await writeFile(join(home, "src", "a.ts"), "export {}", "utf8");
		expect(matchesAnyGlob(home, join(homeAlias, "src", "a.ts"), ["src/**/*.ts"])).toBe(true);
		expect(matchesAnyGlob(home, join(homeAlias, "src", "new.ts"), ["src/**/*.ts"])).toBe(true);
	});
});
