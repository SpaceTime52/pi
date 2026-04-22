import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { beforeEach, describe, expect, it, vi } from "vitest";

const notify = vi.fn();
const setHeader = vi.fn();
const setFooter = vi.fn();
const setEditorComponent = vi.fn();
const setWorkingIndicator = vi.fn();
const setHiddenThinkingLabel = vi.fn();
const setTitle = vi.fn();
const applyClaudeTheme = vi.fn(() => ({ success: true, error: undefined }));
const editorCtor = vi.fn();
vi.mock("../src/theme.ts", () => ({ applyClaudeTheme }));
vi.mock("../src/indicator.ts", () => ({ WORKING_INDICATOR: ["frame"] }));
vi.mock("../src/header.ts", () => ({ getProjectName: () => "demo", createClaudeHeader: () => "header" }));
vi.mock("../src/footer.ts", () => ({ createClaudeFooter: () => "footer" }));
vi.mock("../src/editor.ts", () => ({ ClaudeCodeEditor: class { constructor(...args: unknown[]) { editorCtor(...args); } } }));

const { applyClaudeChrome } = await import("../src/chrome.ts");

describe("applyClaudeChrome", () => {
	let ctx: ExtensionContext;

	beforeEach(() => {
		vi.clearAllMocks();
		ctx = { cwd: "/tmp/demo", ui: { theme: { fg: vi.fn(), bold: vi.fn() }, setHeader, setFooter, setEditorComponent, setWorkingIndicator, setHiddenThinkingLabel, setTitle, notify } } as ExtensionContext;
	});

	it("applies chrome and creates an editor", () => {
		applyClaudeChrome(ctx);
		expect(setHeader).toHaveBeenCalledWith("header");
		expect(setFooter).toHaveBeenCalledWith("footer");
		const factory = setEditorComponent.mock.calls[0]?.[0] as (tui: object, theme: object, keybindings: object) => object;
		factory({}, {}, {});
		expect(editorCtor).toHaveBeenCalled();
		expect(setWorkingIndicator).toHaveBeenCalled();
		expect(setHiddenThinkingLabel).toHaveBeenCalledWith("thinking");
		expect(setTitle).toHaveBeenCalledWith("pi · demo");
	});

	it("notifies when the theme switch fails", () => {
		applyClaudeTheme.mockReturnValueOnce({ success: false, error: "boom" });
		applyClaudeChrome(ctx);
		applyClaudeTheme.mockReturnValueOnce({ success: false, error: undefined });
		applyClaudeChrome(ctx);
		expect(notify).toHaveBeenCalledWith("Claude UI applied, but theme switch failed: boom", "warning");
		expect(notify).toHaveBeenCalledWith("Claude UI applied, but theme switch failed: unknown error", "warning");
	});
});
