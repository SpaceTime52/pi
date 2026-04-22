import type { Theme } from "@mariozechner/pi-coding-agent";
import { Container, Text } from "@mariozechner/pi-tui";
import { resolveFromModule } from "./internal-module.js";
import { branchBlock, inlineSuffix, summarizeArgs, summarizeTextPreview, toolLabel, toolPrefix } from "./tool-utils.js";

type ResultDetails = {
	truncation?: { truncated?: boolean };
	totalResults?: number;
	successful?: number;
	urlCount?: number;
	totalChars?: number;
};

type ToolExecutionPrototype = {
	createCallFallback(): object;
	createResultFallback(): object | undefined;
	getCallRenderer(): object | undefined;
	getResultRenderer(): object | undefined;
	getRenderShell(): string;
	getTextOutput(): string | undefined;
	toolName: string;
	args: unknown;
	expanded: boolean;
	isPartial: boolean;
	result?: { isError?: boolean; details?: ResultDetails };
	rendererState: { summary?: string };
	toolDefinition?: { renderCall?: object; renderResult?: object };
	builtInToolDefinition?: object;
	__claudeCodeUiPatched?: boolean;
};

type ToolExecutionModule = { ToolExecutionComponent?: { prototype?: ToolExecutionPrototype }; theme?: Theme };
type ToolExecutionLoader = () => Promise<ToolExecutionModule>;

function isGenericTool(tool: ToolExecutionPrototype) {
	return !!tool.toolDefinition && !tool.builtInToolDefinition;
}

function summarizeDetails(details?: ResultDetails) {
	if (typeof details?.totalResults === "number") return `${details.totalResults} sources`;
	if (typeof details?.successful === "number" && typeof details?.urlCount === "number") return `${details.successful}/${details.urlCount} URLs`;
	if (typeof details?.totalChars === "number") return `${details.totalChars} chars`;
}

export function patchToolExecutionPrototype(prototype?: ToolExecutionPrototype, theme?: Theme) {
	if (!prototype || !theme || prototype.__claudeCodeUiPatched) return false;
	const shell = prototype.getRenderShell;
	const getCallRenderer = prototype.getCallRenderer;
	const getResultRenderer = prototype.getResultRenderer;
	const call = prototype.createCallFallback;
	const result = prototype.createResultFallback;
	prototype.getCallRenderer = function getCallRendererPatched() { return isGenericTool(this) ? undefined : getCallRenderer.call(this); };
	prototype.getResultRenderer = function getResultRendererPatched() { return isGenericTool(this) ? undefined : getResultRenderer.call(this); };
	prototype.getRenderShell = function getRenderShellPatched() { return isGenericTool(this) ? "self" : shell.call(this); };
	prototype.createCallFallback = function createCallFallbackPatched() {
		if (!isGenericTool(this)) return call.call(this);
		const args = summarizeArgs(this.args);
		return new Text(`${toolPrefix(theme, toolLabel(this.toolName))}${args ? ` ${theme.fg("muted", args)}` : ""}${inlineSuffix(theme, this.rendererState.summary)}`, 0, 0);
	};
	prototype.createResultFallback = function createResultFallbackPatched() {
		if (!isGenericTool(this)) return result.call(this);
		const output = this.getTextOutput() ?? "";
		const status = this.isPartial ? theme.fg("warning", "running…") : this.result?.isError ? theme.fg("error", "error") : theme.fg("success", summarizeDetails(this.result?.details) ?? "done");
		this.rendererState.summary = `${status}${this.result?.details?.truncation?.truncated ? theme.fg("dim", " · truncated") : ""}`;
		if (!this.expanded || !output.trim()) return new Container();
		return new Text(branchBlock(theme, summarizeTextPreview(theme, output, 4)), 0, 0);
	};
	prototype.__claudeCodeUiPatched = true;
	return true;
}

/* v8 ignore next 8 */
async function loadToolExecutionModule() {
	const main = import.meta.resolve("@mariozechner/pi-coding-agent");
	const [toolExecution, interactiveTheme] = await Promise.all([
		import(resolveFromModule(main, "modes/interactive/components/tool-execution.js")),
		import(resolveFromModule(main, "modes/interactive/theme/theme.js")),
	]);
	return { ToolExecutionComponent: toolExecution.ToolExecutionComponent, theme: interactiveTheme.theme };
}

export async function applyToolExecutionPatch(load: ToolExecutionLoader = loadToolExecutionModule) {
	const module = await load();
	patchToolExecutionPrototype(module.ToolExecutionComponent?.prototype, module.theme);
}
