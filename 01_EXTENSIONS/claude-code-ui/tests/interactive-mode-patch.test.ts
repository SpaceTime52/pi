import { describe, expect, it } from "vitest";
import { applyInteractiveModePatch, patchInteractiveModePrototype } from "../src/interactive-mode-patch.ts";

class Mode {
	calls: string[] = [];
	statusContainer = { id: "status" };
	widgetContainerAbove = { id: "widgets" };
	editorContainer = { id: "editor" };
	ui = { children: ["header", this.statusContainer, this.widgetContainerAbove, this.editorContainer] };
	setExtensionWidget(key: string) {
		this.calls.push(key);
	}
}

class HeadlessMode {
	calls: string[] = [];
	setExtensionWidget(key: string) {
		this.calls.push(key);
	}
}

class PartialMode extends HeadlessMode {
	ui = { children: ["header"] };
	widgetContainerAbove = { id: "widgets" };
}

describe("interactive mode patch", () => {
	it("reorders widgets and keeps agents above tasks", async () => {
		expect(patchInteractiveModePrototype()).toBe(false);
		expect(patchInteractiveModePrototype(Mode.prototype)).toBe(true);
		const mode = new Mode();
		mode.setExtensionWidget("notes", ["notes"]);
		mode.setExtensionWidget("tasks", ["tasks"]);
		mode.setExtensionWidget("agents", ["agents"], { placement: "aboveEditor" });
		mode.setExtensionWidget("tasks", undefined, { placement: "aboveEditor" });
		mode.setExtensionWidget("tasks", ["tasks"], { placement: "belowEditor" });
		expect(mode.calls).toEqual(["notes", "tasks", "agents", "tasks", "tasks", "agents", "tasks", "agents"]);
		expect(mode.ui.children).toEqual(["header", mode.widgetContainerAbove, mode.statusContainer, mode.editorContainer]);
		expect(patchInteractiveModePrototype(Mode.prototype)).toBe(false);
		await applyInteractiveModePatch(async () => ({}));
	});

	it("handles missing UI containers and loader-based patching", async () => {
		expect(patchInteractiveModePrototype(HeadlessMode.prototype)).toBe(true);
		expect(patchInteractiveModePrototype(PartialMode.prototype)).toBe(false);
		const headless = new HeadlessMode();
		const partial = new PartialMode();
		headless.setExtensionWidget("agents", ["agents"], { placement: "aboveEditor" });
		partial.setExtensionWidget("agents", ["agents"], { placement: "aboveEditor" });
		await applyInteractiveModePatch(async () => ({ InteractiveMode: { prototype: HeadlessMode.prototype } }));
		expect(headless.calls).toEqual(["agents"]);
		expect(partial.calls).toEqual(["agents"]);
	});
});
