import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";
import { createClaudeFooter } from "../src/footer.ts";
import { createClaudeHeader, getProjectName } from "../src/header.ts";
import { THEME_NAME, applyClaudeTheme } from "../src/theme.ts";
import { render, theme } from "./helpers.ts";

function createCtx(percent: number | null, branchEntries: object[], modelId = "sonnet") {
	return {
		cwd: "/tmp/demo",
		model: modelId ? { id: modelId } : undefined,
		sessionManager: { getBranch: () => branchEntries },
		getContextUsage: () => ({ tokens: 0, contextWindow: 1, percent }),
		ui: { setTheme: vi.fn(() => ({ success: true })), theme },
	} as ExtensionContext;
}

describe("theme, header and footer", () => {
	it("applies the claude dark theme and renders the header", () => {
		const ctx = createCtx(42, []);
		const header = createClaudeHeader(ctx)({}, theme);
		expect(applyClaudeTheme(ctx)).toEqual({ themeName: THEME_NAME, success: true, error: undefined });
		expect(ctx.ui.setTheme).toHaveBeenCalledWith(THEME_NAME);
		expect(getProjectName(ctx)).toBe("demo");
		expect(getProjectName({ cwd: "" } as ExtensionContext)).toBe("");
		header.invalidate();
		expect(render(header)).toContain("claude-code-dark");
	});

	it("renders token, cost, branch and model info", () => {
		const entries = [{ type: "message", message: { role: "assistant", usage: { input: 5000, output: 12000, cost: { total: 1.234 } } } }];
		const ctx = createCtx(42, entries);
		let onChange = () => {};
		const footer = createClaudeFooter(ctx)({ requestRender: vi.fn() }, theme, { onBranchChange: (fn) => (onChange = fn, vi.fn()), getGitBranch: () => "main" });
		footer.invalidate();
		onChange();
		const text = render(footer, 220);
		expect(text).toContain("main");
		expect(text).toContain("sonnet");
		expect(text).toContain("ctx 42%");
		expect(text).toContain("↑5.0k ↓12k");
		expect(text).toContain("$1.234");
	});

	it("renders fallback values when branch or model are missing", () => {
		const entries = [
			{ type: "message", message: { role: "user" } },
			{ type: "message", message: { role: "assistant", usage: { input: 12, output: 900, cost: { total: 0.5 } } } },
		];
		const ctx = createCtx(null, entries, "");
		const footer = createClaudeFooter(ctx)({ requestRender: vi.fn() }, theme, { onBranchChange: () => vi.fn(), getGitBranch: () => null });
		const text = render(footer, 220);
		expect(text).toContain("no-model");
		expect(text).toContain("ctx --");
		expect(text).toContain("↑12 ↓900");
	});
});
