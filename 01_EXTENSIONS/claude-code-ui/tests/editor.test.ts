import type { KeybindingsManager } from "@mariozechner/pi-coding-agent";
import type { EditorTheme, TUI } from "@mariozechner/pi-tui";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@mariozechner/pi-coding-agent", () => ({
	CustomEditor: class {
		borderColor = (text: string) => `{${text}}`;
		lines = ["────", "body", "────"];
		constructor(..._args: unknown[]) {}
		render() { return this.lines; }
	},
}));

const { ClaudeCodeEditor } = await import("../src/editor.ts");

describe("ClaudeCodeEditor", () => {
	let editor: ClaudeCodeEditor & { lines: string[] };

	beforeEach(() => {
		editor = new ClaudeCodeEditor(
			{} as TUI,
			{} as EditorTheme,
			{} as KeybindingsManager,
			(text) => `<${text}>`,
			(text) => `[${text}]`,
		) as ClaudeCodeEditor & { lines: string[] };
	});

	it("decorates the top and bottom borders", () => {
		const lines = editor.render(32);
		expect(lines[0]).toContain("prompt");
		expect(lines[2]).toContain("enter send");
	});

	it("keeps non-rule lines unchanged and handles empty renders", () => {
		editor.lines = ["head", "body", "tail"];
		expect(editor.render(24)).toEqual(["head", "body", "tail"]);
		editor.lines = [];
		expect(editor.render(24)).toEqual([]);
		editor.lines = ["────", "body", "─── ↓ 3 more "];
		expect(editor.render(24)[2]).toBe("─── ↓ 3 more ");
	});
});
