import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearOverviewUi, restoreOverview } from "../src/handlers.js";
import { stubContext, stubRuntime } from "./helpers.js";

const originalColumns = process.stdout.columns;
const originalRows = process.stdout.rows;
const branch = (title: string, ...summary: string[]) => [{ type: "custom", id: "1", customType: "auto-session-title.overview", data: { title, summary } }];

function setTerminalSize(columns: number, rows: number = originalRows ?? 40): void {
	Object.defineProperty(process.stdout, "columns", { configurable: true, value: columns });
	Object.defineProperty(process.stdout, "rows", { configurable: true, value: rows });
}

describe("overview restoration overlay layout", () => {
	beforeEach(() => {
		setTerminalSize(128);
		clearOverviewUi(new Set(), stubContext());
	});
	afterEach(() => {
		Object.defineProperty(process.stdout, "columns", { configurable: true, value: originalColumns });
		Object.defineProperty(process.stdout, "rows", { configurable: true, value: originalRows });
	});
	it("collapses to a title-only overlay when the terminal is very short", () => {
		setTerminalSize(128, 17);
		const ctx = stubContext(branch("현재 세션", "현재 상태를 짧게 표시함"));
		restoreOverview(stubRuntime(), ctx);
		const rendered = ctx.overlay.component?.render(64).join("\n") ?? "";
		expect(rendered).toContain("현재 세션");
		expect(rendered).not.toContain("현재 상태를 짧게 표시함");
	});
	it("caps the overlay body to one summarized line on moderately short terminals", () => {
		setTerminalSize(128, 23);
		const ctx = stubContext(branch("현재 세션", "첫 줄은 그대로 보이고", "둘째 줄은 축약되어야 함"));
		restoreOverview(stubRuntime(), ctx);
		const rendered = ctx.overlay.component?.render(36).join("\n") ?? "";
		expect(rendered).toContain("첫 줄은 그대로 보이고 …");
		expect(rendered).not.toContain("둘째 줄은 축약되어야 함");
	});
});
