import { join } from "node:path";
import { listMarkdownFiles, readText, fileExists, resolveRealPath } from "../core/fs-utils.js";
import { buildInstructionSection, expandImportsWithTrace, findProjectRoot, isHomeGitRoot, isHomePath, parseFrontmatter, projectAncestorDirs, stripHtmlComments } from "../core/instructions.js";
import { matchesAbsoluteGlobs } from "../core/globs.js";
import { isPathInside, scopeLabel, sha } from "../core/pathing.js";
import type { Block, InstructionLoad, Scope } from "../core/types.js";

export interface InstructionState {
	instructionFiles: string[];
	instructions: Block[];
	unconditionalPromptText: string;
	conditionalRules: Block[];
	eagerLoads: InstructionLoad[];
}

export function collectInstructions(cwd: string, excludes: string[] | undefined): InstructionState {
	const projectRoot = findProjectRoot(cwd);
	const instructionFiles: string[] = [];
	const instructions: Block[] = [];
	const seen = new Set<string>();
	const add = (path: string, scope: Scope, kind: Block["kind"], ownerRoot: string, content: string, globs: string[] = []) => {
		if (shouldSkip(path, excludes)) return;
		const key = `${resolveRealPath(path)}:${kind}:${globs.join(",")}`;
		if (seen.has(key)) return;
		const expanded = expandImportsWithTrace(stripHtmlComments(content), path, scope, ownerRoot);
		const text = expanded.text.trim();
		if (!text) return;
		seen.add(key);
		instructions.push({ id: sha(`${path}:${globs.join(",")}`), path, scope, kind, ownerRoot, content: text, conditionalGlobs: globs, includes: expanded.includes });
		instructionFiles.push(path);
	};
	loadUserFiles(add, excludes);
	loadAncestorFiles(cwd, projectRoot, add, excludes);
	for (const path of listImportedInstructionFiles(instructions)) if (!instructionFiles.includes(path)) instructionFiles.push(path);
	const unconditionalPromptText = instructions.filter((item) => item.conditionalGlobs.length === 0).map((item) => buildInstructionSection(item.kind === "rule" ? `Claude rule (${scopeLabel(item.scope)})` : `Claude instructions (${scopeLabel(item.scope)})`, item.path, item.content)).join("\n\n");
	const conditionalRules = instructions.filter((item) => item.conditionalGlobs.length > 0);
	const eagerLoads = instructions.filter((item) => item.conditionalGlobs.length === 0).flatMap((item) => blockToLoads(item, "session_start"));
	return { instructionFiles, instructions, unconditionalPromptText, conditionalRules, eagerLoads };
}

export function blockToLoads(block: Block, loadReason: InstructionLoad["loadReason"], triggerFilePath?: string): InstructionLoad[] {
	const base = [{ filePath: block.path, scope: block.scope, loadReason, globs: block.conditionalGlobs.length > 0 ? block.conditionalGlobs : undefined, triggerFilePath }];
	return [...base, ...block.includes.map((item) => ({ filePath: item.path, scope: block.scope, loadReason: "include" as const, triggerFilePath, parentFilePath: item.parentPath }))];
}

export function listInstructionWatchFiles(cwd: string, currentInstructionFiles: string[] = [], excludes: string[] | undefined = []) {
	const projectRoot = findProjectRoot(cwd);
	const paths = new Set(currentInstructionFiles);
	for (const path of listUserInstructionCandidates()) if (!shouldSkip(path, excludes)) paths.add(path);
	for (const path of listAncestorInstructionCandidates(cwd, projectRoot)) if (!shouldSkip(path, excludes)) paths.add(path);
	return [...paths];
}

function loadUserFiles(add: any, excludes: string[] | undefined) {
	const home = process.env.HOME || "";
	if (!home) return;
	const claude = join(home, ".claude", "CLAUDE.md");
	if (fileExists(claude) && !shouldSkip(claude, excludes)) add(claude, "user", "claude", home, readText(claude) || "");
	for (const path of listUserRuleFiles().filter((item) => !shouldSkip(item, excludes))) {
		const parsed = parseFrontmatter(readText(path) || "");
		add(path, "user", "rule", home, parsed.body, parsed.paths);
	}
}

function loadAncestorFiles(cwd: string, projectRoot: string, add: any, excludes: string[] | undefined) {
	for (const dir of listInstructionAncestorDirs(cwd, projectRoot)) {
		for (const [path, scope] of [[join(dir, "CLAUDE.md"), "project"], [join(dir, ".claude", "CLAUDE.md"), "project"], [join(dir, "CLAUDE.local.md"), "local"]] as const) if (fileExists(path) && !shouldSkip(path, excludes)) add(path, scope, "claude", projectRoot, readText(path) || "");
		for (const path of listMarkdownFiles(join(dir, ".claude", "rules")).filter((item) => !shouldSkip(item, excludes))) {
			const parsed = parseFrontmatter(readText(path) || "");
			add(path, "project", "rule", projectRoot, parsed.body, parsed.paths);
		}
	}
}

function listImportedInstructionFiles(instructions: Block[]) {
	return instructions.flatMap((item) => item.includes.map((include) => include.path));
}

function listUserInstructionCandidates() {
	const home = process.env.HOME || "";
	return home ? [join(home, ".claude", "CLAUDE.md"), ...listUserRuleFiles()] : [];
}
function listUserRuleFiles() {
	const home = process.env.HOME || "";
	return home ? listMarkdownFiles(join(home, ".claude", "rules")) : [];
}

function listAncestorInstructionCandidates(cwd: string, projectRoot: string) {
	return listInstructionAncestorDirs(cwd, projectRoot).flatMap((dir) => [join(dir, "CLAUDE.md"), join(dir, ".claude", "CLAUDE.md"), join(dir, "CLAUDE.local.md"), ...listMarkdownFiles(join(dir, ".claude", "rules"))]);
}

function listInstructionAncestorDirs(cwd: string, projectRoot: string) {
	const allowHome = isHomeGitRoot(projectRoot);
	return projectAncestorDirs(cwd).filter((item) => (allowHome || !isHomePath(item)) && (item === projectRoot || isPathInside(projectRoot, item)));
}

function shouldSkip(path: string, excludes: string[] | undefined) {
	return Array.isArray(excludes) && excludes.length > 0 && matchesAbsoluteGlobs(path, excludes);
}
