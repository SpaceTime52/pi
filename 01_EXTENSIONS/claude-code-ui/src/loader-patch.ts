import { stripAnsi } from "./ansi.js";
import { resolveFromModule } from "./internal-module.js";

type LoaderPrototype = {
	render(width: number): string[];
	__claudeCodeUiPatched?: boolean;
};

type LoaderModule = { Loader?: { prototype?: LoaderPrototype } };
type LoaderFactory = () => Promise<LoaderModule>;

function isBlank(lines: string[]) {
	for (const line of lines) if (stripAnsi(line).trim()) return false;
	return true;
}

export function patchLoaderPrototype(prototype?: LoaderPrototype) {
	if (!prototype || prototype.__claudeCodeUiPatched) return false;
	const render = prototype.render;
	prototype.render = function renderPatched(width) {
		const lines = render.call(this, width);
		return isBlank(lines) ? [] : lines;
	};
	prototype.__claudeCodeUiPatched = true;
	return true;
}

/* v8 ignore next 4 */
async function loadLoaderModule() {
	const main = import.meta.resolve("@mariozechner/pi-coding-agent");
	return import(resolveFromModule(main, "../node_modules/@mariozechner/pi-tui/dist/components/loader.js"));
}

export async function applyLoaderPatch(load: LoaderFactory = loadLoaderModule) {
	const module = await load();
	patchLoaderPrototype(module.Loader?.prototype);
}
