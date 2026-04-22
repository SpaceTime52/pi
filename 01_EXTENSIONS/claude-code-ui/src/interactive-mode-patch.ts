import { resolveFromModule } from "./internal-module.js";

const ORDER = ["agents", "tasks"];
const STATE = Symbol.for("claudeCodeUi.widgetOrder");

type Options = { placement?: "aboveEditor" | "belowEditor" };
type Entry = { content: unknown; options?: Options };
type Mode = {
	ui?: { children: unknown[] };
	statusContainer?: unknown;
	widgetContainerAbove?: unknown;
	editorContainer?: unknown;
	setExtensionWidget(key: string, content: unknown, options?: Options): void;
	[STATE]?: Map<string, Entry>;
	__claudeCodeUiPatched?: boolean;
};
type Module = { InteractiveMode?: { prototype?: Mode } };
type Loader = () => Promise<Module>;

function reorder(mode: Mode) {
	const ui = mode.ui;
	if (!ui) return;
	const children = ui.children;
	const targets = [mode.widgetContainerAbove, mode.statusContainer, mode.editorContainer];
	if (targets.some((item) => item === undefined)) return;
	let inserted = false;
	ui.children = children.flatMap((child) => {
		if (!targets.includes(child)) return [child];
		if (inserted) return [];
		inserted = true;
		return targets;
	});
}

function applyOrderedWidgets(mode: Mode, setWidget: Mode["setExtensionWidget"]) {
	for (const key of ORDER) {
		const entry = mode[STATE]?.get(key);
		if (entry) setWidget.call(mode, key, entry.content, entry.options);
	}
}

export function patchInteractiveModePrototype(prototype?: Mode) {
	if (!prototype || prototype.__claudeCodeUiPatched) return false;
	const setWidget = prototype.setExtensionWidget;
	prototype.setExtensionWidget = function setExtensionWidgetPatched(key, content, options) {
		reorder(this);
		if (!ORDER.includes(key)) return setWidget.call(this, key, content, options);
		const placement = options?.placement ?? "aboveEditor";
		if (!this[STATE]) this[STATE] = new Map<string, Entry>();
		if (content === undefined || placement !== "aboveEditor") {
			this[STATE]?.delete(key);
			setWidget.call(this, key, content, options);
			return applyOrderedWidgets(this, setWidget);
		}
		this[STATE]?.set(key, { content, options });
		applyOrderedWidgets(this, setWidget);
	};
	prototype.__claudeCodeUiPatched = true;
	return true;
}

/* v8 ignore next 4 */
async function loadInteractiveModeModule() {
	const main = import.meta.resolve("@mariozechner/pi-coding-agent");
	return import(resolveFromModule(main, "../modes/interactive/interactive-mode.js"));
}

export async function applyInteractiveModePatch(load: Loader = loadInteractiveModeModule) {
	const module = await load();
	patchInteractiveModePrototype(module.InteractiveMode?.prototype);
}
