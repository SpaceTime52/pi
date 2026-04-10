import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearOverviewUi, restoreOverview } from "../src/handlers.js";
import { stubContext, stubRuntime } from "./helpers.js";

const originalColumns = process.stdout.columns;
const originalRows = process.stdout.rows;
function setTerminalSize(columns: number, rows: number = originalRows ?? 40): void {
	Object.defineProperty(process.stdout, "columns", { configurable: true, value: columns });
	Object.defineProperty(process.stdout, "rows", { configurable: true, value: rows });
}
function deferred<T>(): { promise: Promise<T>; resolve(value: T): void; reject(error: unknown): void } {
	let resolve = (_value: T) => undefined;
	let reject = (_error: unknown) => undefined;
	const promise = new Promise<T>((nextResolve, nextReject) => { resolve = nextResolve; reject = nextReject; });
	return { promise, resolve, reject };
}

describe("overview overlay async races", () => {
	beforeEach(() => {
		setTerminalSize(128);
		clearOverviewUi(new Set(), stubContext());
	});
	afterEach(() => {
		Object.defineProperty(process.stdout, "columns", { configurable: true, value: originalColumns });
		Object.defineProperty(process.stdout, "rows", { configurable: true, value: originalRows });
	});
	it("ignores stale onHandle callbacks after a resize recreate", () => {
		const ctx = stubContext([{ type: "custom", id: "1", customType: "auto-session-title.overview", data: { title: "현재 세션", summary: ["현재 상태를 짧게 표시함"] } }]);
		const secondOverlay = stubContext().overlay;
		let staleOnHandle: ((handle: typeof ctx.overlay.handle) => void) | undefined;
		ctx.ui.custom.mockImplementationOnce((factory, options) => {
			ctx.overlay.component = factory(ctx.overlay.tui, ctx.overlay.theme, {}, vi.fn());
			staleOnHandle = options?.onHandle as typeof staleOnHandle;
			ctx.overlay.options = options;
			return Promise.resolve();
		}).mockImplementationOnce((factory, options) => {
			secondOverlay.component = factory(secondOverlay.tui, secondOverlay.theme, {}, vi.fn());
			secondOverlay.options = options;
			options?.onHandle?.(secondOverlay.handle);
			return Promise.resolve();
		});
		restoreOverview(stubRuntime(), ctx);
		setTerminalSize(140);
		process.stdout.emit("resize");
		staleOnHandle?.(ctx.overlay.handle);
		clearOverviewUi(new Set(), ctx);
		expect(secondOverlay.handle.hide).toHaveBeenCalledTimes(1);
		expect(ctx.overlay.handle.hide).not.toHaveBeenCalled();
	});
	it("ignores late rejections from the pre-resize overlay", async () => {
		const pending = deferred<void>();
		const ctx = stubContext([{ type: "custom", id: "1", customType: "auto-session-title.overview", data: { title: "현재 세션", summary: ["현재 상태를 짧게 표시함"] } }]);
		const secondOverlay = stubContext().overlay;
		ctx.ui.custom.mockImplementationOnce((factory, options) => {
			ctx.overlay.component = factory(ctx.overlay.tui, ctx.overlay.theme, {}, vi.fn());
			ctx.overlay.options = options;
			return pending.promise;
		}).mockImplementationOnce((factory, options) => {
			secondOverlay.component = factory(secondOverlay.tui, secondOverlay.theme, {}, vi.fn());
			secondOverlay.options = options;
			options?.onHandle?.(secondOverlay.handle);
			return Promise.resolve();
		});
		restoreOverview(stubRuntime(), ctx);
		setTerminalSize(140);
		process.stdout.emit("resize");
		pending.reject(new Error("late failure"));
		await Promise.resolve();
		await Promise.resolve();
		expect(secondOverlay.handle.hide).not.toHaveBeenCalled();
		clearOverviewUi(new Set(), ctx);
		expect(secondOverlay.handle.hide).toHaveBeenCalledTimes(1);
	});
});
