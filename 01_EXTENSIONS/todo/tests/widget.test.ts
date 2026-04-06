import { describe, it, expect, beforeEach, vi } from "vitest";
import { syncWidget, cleanupWidget, setAgentRunning, incrementTurn } from "../src/widget.js";
import { addTodo, clearTodos, toggleTodo } from "../src/state.js";

function stubCtx() {
	return {
		hasUI: true,
		ui: { setWidget: vi.fn() },
	};
}

function stubPi() {
	return { appendEntry: vi.fn() };
}

describe("syncWidget", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		clearTodos();
		cleanupWidget(stubCtx());
	});

	it("clears widget when no todos", () => {
		const ctx = stubCtx();
		syncWidget(ctx);
		expect(ctx.ui.setWidget).toHaveBeenCalledWith("todo", undefined);
	});

	it("sets widget factory when todos exist", () => {
		addTodo("task");
		const ctx = stubCtx();
		syncWidget(ctx);
		expect(ctx.ui.setWidget).toHaveBeenCalledWith("todo", expect.any(Function));
	});

	it("skips when hasUI is false", () => {
		addTodo("task");
		const ctx = { hasUI: false, ui: { setWidget: vi.fn() } };
		syncWidget(ctx);
		expect(ctx.ui.setWidget).not.toHaveBeenCalled();
	});

	it("hides and clears state after enough turns when all done", () => {
		addTodo("task");
		toggleTodo(1);
		const pi = stubPi();
		const ctx = stubCtx();
		syncWidget(ctx, pi);
		expect(ctx.ui.setWidget).toHaveBeenCalledWith("todo", expect.any(Function));

		incrementTurn();
		incrementTurn();
		const ctx2 = stubCtx();
		syncWidget(ctx2, pi);
		expect(ctx2.ui.setWidget).toHaveBeenCalledWith("todo", undefined);
		expect(pi.appendEntry).toHaveBeenCalledWith("todo-state", expect.objectContaining({ todos: [] }));
	});

	it("cleanupWidget resets all state", () => {
		addTodo("task");
		setAgentRunning(true);
		incrementTurn();
		const ctx = stubCtx();
		cleanupWidget(ctx);
		expect(ctx.ui.setWidget).toHaveBeenCalledWith("todo", undefined);
	});

	it("clears spinner timer on re-sync (covers clearInterval branch)", () => {
		addTodo("running task");
		setAgentRunning(true);
		const ctx = stubCtx();
		syncWidget(ctx);
		const factory = ctx.ui.setWidget.mock.calls[0][1] as (tui: unknown, theme: unknown) => unknown;
		factory(
			{ requestRender: vi.fn() },
			{ fg: (_c: string, t: string) => t, bold: (t: string) => t, strikethrough: (t: string) => t },
		);
		const ctx2 = stubCtx();
		syncWidget(ctx2);
		expect(ctx2.ui.setWidget).toHaveBeenCalled();
	});

	it("hide timer fires and re-syncs (covers setTimeout callback)", () => {
		addTodo("done task");
		toggleTodo(1);
		const pi = stubPi();
		const ctx = stubCtx();
		syncWidget(ctx, pi);
		vi.runAllTimers();
		expect(ctx.ui.setWidget).toHaveBeenCalled();
	});

	it("cleanupWidget with hasUI false skips setWidget", () => {
		const ctx = { hasUI: false, ui: { setWidget: vi.fn() } };
		cleanupWidget(ctx);
		expect(ctx.ui.setWidget).not.toHaveBeenCalled();
	});
});
