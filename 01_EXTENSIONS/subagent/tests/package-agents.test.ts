import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ base: vi.fn(() => "base-result") }));
vi.mock("@jeonghyeon.net/pi-subagents/dist/index.js", () => ({ default: mocks.base }));

import extension, { defaultAgentTargetDir, installPackagedAgents, packagedAgentDir } from "../src/package-agents.ts";

function tempDir(): string {
	return mkdtempSync(join(tmpdir(), "pi-subagent-presets-"));
}

describe("packaged subagent presets", () => {
	it("reports package and default target directories", () => {
		const original = process.env.PI_SUBAGENT_PRESET_TARGET_DIR;
		delete process.env.PI_SUBAGENT_PRESET_TARGET_DIR;
		expect(packagedAgentDir()).toContain("agents");
		expect(defaultAgentTargetDir()).toContain(join(".pi", "agent", "agents"));
		process.env.PI_SUBAGENT_PRESET_TARGET_DIR = "/tmp/custom-agents";
		expect(defaultAgentTargetDir()).toBe("/tmp/custom-agents");
		if (original === undefined) delete process.env.PI_SUBAGENT_PRESET_TARGET_DIR;
		else process.env.PI_SUBAGENT_PRESET_TARGET_DIR = original;
	});

	it("copies markdown presets with a managed marker", () => {
		const source = tempDir();
		const target = tempDir();
		writeFileSync(join(source, "reviewer.md"), "---\ndescription: Review\n---\nBody\n");

		const installed = installPackagedAgents(source, target);
		const copied = readFileSync(join(target, "reviewer.md"), "utf8");

		expect(installed).toEqual(["reviewer.md"]);
		expect(copied).toContain("managed-by: jeonghyeon-pi-package-subagents");
		expect(copied).toContain("Body");
		expect(installPackagedAgents(source, target)).toEqual([]);

		rmSync(source, { recursive: true, force: true });
		rmSync(target, { recursive: true, force: true });
	});

	it("updates managed files but does not overwrite user-owned files", () => {
		const source = tempDir();
		const target = tempDir();
		const targetPath = join(target, "reviewer.md");
		writeFileSync(join(source, "reviewer.md"), "package version");
		writeFileSync(targetPath, "user version");

		expect(installPackagedAgents(source, target)).toEqual([]);
		expect(readFileSync(targetPath, "utf8")).toBe("user version");

		writeFileSync(targetPath, "# managed-by: jeonghyeon-pi-package-subagents\nold");
		expect(installPackagedAgents(source, target)).toEqual(["reviewer.md"]);
		expect(readFileSync(targetPath, "utf8")).toContain("package version");

		rmSync(source, { recursive: true, force: true });
		rmSync(target, { recursive: true, force: true });
	});

	it("ignores missing source directories and installs before delegating", () => {
		const target = tempDir();
		const original = process.env.PI_SUBAGENT_PRESET_TARGET_DIR;
		process.env.PI_SUBAGENT_PRESET_TARGET_DIR = target;

		expect(installPackagedAgents(join(target, "missing"), target)).toEqual([]);
		expect(extension({})).toBe("base-result");
		expect(mocks.base).toHaveBeenCalled();
		expect(existsSync(join(target, "afk-implementer.md"))).toBe(true);

		if (original === undefined) delete process.env.PI_SUBAGENT_PRESET_TARGET_DIR;
		else process.env.PI_SUBAGENT_PRESET_TARGET_DIR = original;
		rmSync(target, { recursive: true, force: true });
	});
});
