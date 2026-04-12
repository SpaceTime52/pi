import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearOverviewUi, restoreOverview } from "../src/handlers.js";
import { stubContext, stubRuntime } from "./helpers.js";

const originalColumns = process.stdout.columns;
const originalRows = process.stdout.rows;
const originalIsTTY = process.stdout.isTTY;

function setTerminal(columns: number, isTTY: boolean, rows: number = originalRows ?? 40): void {
	Object.defineProperty(process.stdout, "columns", { configurable: true, value: columns });
	Object.defineProperty(process.stdout, "rows", { configurable: true, value: rows });
	Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: isTTY });
}

describe("overview narrow widget mode", () => {
	beforeEach(() => {
		setTerminal(80, true);
		clearOverviewUi(new Set(), stubContext());
	});
	afterEach(() => {
		Object.defineProperty(process.stdout, "columns", { configurable: true, value: originalColumns });
		Object.defineProperty(process.stdout, "rows", { configurable: true, value: originalRows });
		Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: originalIsTTY });
	});
	it("shows a compact overview above the editor when the terminal is narrow", () => {
		const ctx = stubContext([{ type: "custom", id: "1", customType: "auto-session-title.overview", data: { title: "현재 세션", summary: ["현재 상태를 짧게 표시함"] } }]);
		restoreOverview(stubRuntime(), ctx);
		expect(ctx.ui.setWidget).toHaveBeenCalledWith("auto-session-title.narrow", expect.any(Function), undefined);
		expect(ctx.ui.custom).not.toHaveBeenCalled();
		const rendered = ctx.widget.component?.render(80).join("\n") ?? "";
		expect(rendered).toContain("현재 세션");
		expect(rendered).not.toContain("현재 상태를 짧게 표시함");
	});

	it("clears the narrow widget before switching back to the overlay", () => {
		const ctx = stubContext([{ type: "custom", id: "1", customType: "auto-session-title.overview", data: { title: "현재 세션", summary: ["현재 상태를 짧게 표시함"] } }]);
		restoreOverview(stubRuntime(), ctx);
		setTerminal(200, true);
		process.stdout.emit("resize");
		expect(ctx.ui.setWidget).toHaveBeenCalledWith("auto-session-title.narrow", undefined);
		expect(ctx.ui.custom).toHaveBeenCalledTimes(1);
	});
});
