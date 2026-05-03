import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import base from "@jeonghyeon.net/pi-subagents/dist/index.js";

const MARKER = "# managed-by: jeonghyeon-pi-package-subagents";

type BasePi = Parameters<typeof base>[0];

export function packagedAgentDir(): string {
	return join(dirname(fileURLToPath(import.meta.url)), "..", "agents");
}

export function defaultAgentTargetDir(): string {
	return process.env.PI_SUBAGENT_PRESET_TARGET_DIR ?? join(homedir(), ".pi", "agent", "agents");
}

function hashText(text: string): string {
	return createHash("sha256").update(text).digest("hex");
}

function withMarker(source: string): string {
	const marker = `${MARKER}\n# source-sha256: ${hashText(source)}`;
	const trimmed = source.trimStart();
	if (trimmed.startsWith("---\n")) return trimmed.replace("---\n", `---\n${marker}\n`);
	return `${marker}\n${trimmed}`;
}

function shouldWrite(targetPath: string, next: string): boolean {
	if (!existsSync(targetPath)) return true;
	const current = readFileSync(targetPath, "utf8");
	if (current === next) return false;
	return current.includes(MARKER);
}

export function installPackagedAgents(sourceDir = packagedAgentDir(), targetDir = defaultAgentTargetDir()): string[] {
	if (!existsSync(sourceDir)) return [];
	mkdirSync(targetDir, { recursive: true });
	const installed: string[] = [];
	for (const file of readdirSync(sourceDir).filter((name) => name.endsWith(".md")).sort()) {
		const sourcePath = join(sourceDir, file);
		const targetPath = join(targetDir, file);
		const next = withMarker(readFileSync(sourcePath, "utf8"));
		if (!shouldWrite(targetPath, next)) continue;
		writeFileSync(targetPath, next, "utf8");
		installed.push(file);
	}
	return installed;
}

export default function (pi: BasePi) {
	installPackagedAgents();
	return base(pi);
}
