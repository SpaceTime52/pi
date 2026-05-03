import { describe, expect, it, vi } from "vitest";
import { createPrCommandHandler } from "../src/pr-actions.ts";
import type { ExecFn, TrackerState } from "../src/types.ts";
import { createContext, trackedState } from "./helpers.ts";

function createDeps(initial: TrackerState = trackedState(), exec: ExecFn = vi.fn(async () => ({ code: 0 }))) {
	let state = initial;
	const setState = vi.fn((next: TrackerState) => { state = next; });
	const refreshTracked = vi.fn(async () => true);
	const handler = createPrCommandHandler({ exec, getState: () => state, setState, refreshTracked });
	return { handler, setState, refreshTracked, get state() { return state; } };
}

describe("pr command actions", () => {
	it("handles help, show, refresh, track, and untrack", async () => {
		const ctx = createContext();
		const deps = createDeps();
		await deps.handler("help", ctx);
		expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining("PR tracker commands"), "info");
		await deps.handler("show", ctx);
		expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining("#63 Ready to merge"), "info");
		await deps.handler("refresh 99", ctx);
		expect(deps.refreshTracked).toHaveBeenCalledWith(ctx, "99", "manual", { notify: true });
		await deps.handler("refresh", ctx);
		expect(deps.refreshTracked).toHaveBeenCalledWith(ctx, "https://github.com/acme/web/pull/63", "manual", { notify: true });
		await deps.handler("track 100", ctx);
		expect(deps.refreshTracked).toHaveBeenCalledWith(ctx, "100", "manual", { notify: true });
		await deps.handler("untrack", ctx);
		expect(deps.setState).toHaveBeenCalledWith({}, ctx);
	});

	it("shows current branch when no PR is tracked", async () => {
		const ctx = createContext();
		const deps = createDeps({});
		await deps.handler("", ctx);
		expect(deps.refreshTracked).toHaveBeenCalledWith(ctx, undefined, "current branch", { notify: true });
	});

	it("opens tracked pull requests and reports failures", async () => {
		const ctx = createContext();
		let deps = createDeps({});
		await deps.handler("open", ctx);
		expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining("No tracked PR"), "warning");
		deps = createDeps({ trackedRef: "feature" });
		await deps.handler("open", ctx);
		expect(ctx.ui.notify).toHaveBeenCalledWith("Opened PR feature.", "info");
		deps = createDeps(trackedState());
		await deps.handler("open", ctx);
		expect(ctx.ui.notify).toHaveBeenCalledWith("Opened PR #63.", "info");
		deps = createDeps(trackedState(), vi.fn(async () => ({ code: 1, stderr: "nope" })));
		await deps.handler("open", ctx);
		expect(ctx.ui.notify).toHaveBeenCalledWith("Could not open PR: nope", "error");
	});

	it("merges after resolving method and confirmation", async () => {
		const ctx = createContext();
		ctx.ui.select = vi.fn(async () => "--merge");
		ctx.ui.confirm = vi.fn(async () => true);
		const deps = createDeps();
		await deps.handler("merge", ctx);
		expect(ctx.ui.select).toHaveBeenCalledWith("Merge method", ["--merge", "--squash", "--rebase", "--auto"]);
		expect(ctx.ui.confirm).toHaveBeenCalled();
		expect(ctx.ui.notify).toHaveBeenCalledWith("Merged PR #63.", "info");
		expect(deps.refreshTracked).toHaveBeenCalledWith(ctx, "https://github.com/acme/web/pull/63", "manual", { notify: false });
	});

	it("handles merge cancellation and invalid flags", async () => {
		const ctx = createContext();
		const deps = createDeps();
		await createDeps({}).handler("merge --squash", ctx);
		expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining("No tracked PR"), "warning");
		await deps.handler("merge --delete-branch", ctx);
		expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining("Use /pr merge"), "warning");
		ctx.ui.confirm = vi.fn(async () => false);
		await deps.handler("merge --squash", ctx);
		expect(ctx.ui.confirm).toHaveBeenCalled();
	});

	it("handles non-interactive, empty selection, and merge failures", async () => {
		await createDeps().handler("merge", createContext(false));
		const ctx = createContext();
		ctx.ui.select = vi.fn(async () => undefined);
		await createDeps().handler("merge", ctx);
		ctx.ui.confirm = vi.fn(async () => true);
		const deps = createDeps(trackedState(), vi.fn(async () => ({ code: 1, stderr: "blocked" })));
		await deps.handler("merge --rebase", ctx);
		expect(ctx.ui.notify).toHaveBeenCalledWith("Merge failed: blocked", "error");
	});
});
