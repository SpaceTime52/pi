import { helpText, hasMergeMethod, mergeHelpText, parsePrCommand } from "./commands.js";
import { mergePullRequest, openPullRequest } from "./github.js";
import { createEmptyState } from "./state.js";
import type { ExecFn, TrackerContext, TrackerState } from "./types.js";
import { formatNotification } from "./ui.js";
import { getTrackedRef, MERGE_METHODS, messageOf, notify } from "./runtime-helpers.js";

interface CommandDeps {
	exec: ExecFn;
	getState(): TrackerState;
	setState(state: TrackerState, ctx?: TrackerContext): void;
	refreshTracked(ctx: TrackerContext, ref: string | undefined, source: string | undefined, options?: { notify?: boolean }): Promise<boolean>;
}

async function handleOpen(ctx: TrackerContext, deps: CommandDeps): Promise<void> {
	const state = deps.getState();
	const ref = getTrackedRef(state);
	if (!ref) return notify(ctx, "No tracked PR. Use /pr track <number|url|branch> first.", "warning");
	try {
		await openPullRequest(deps.exec, ctx.cwd, ref, ctx.signal);
		notify(ctx, `Opened PR ${state.pr ? `#${state.pr.number}` : ref}.`, "info");
	} catch (error) {
		notify(ctx, `Could not open PR: ${messageOf(error)}`, "error");
	}
}

async function resolveMergeArgs(ctx: TrackerContext, args: string[]): Promise<string[] | undefined> {
	if (args.length > 0) {
		if (!hasMergeMethod(args)) notify(ctx, mergeHelpText(), "warning");
		return hasMergeMethod(args) ? args : undefined;
	}
	if (!ctx.hasUI) {
		notify(ctx, mergeHelpText(), "warning");
		return undefined;
	}
	const method = await ctx.ui.select("Merge method", MERGE_METHODS);
	return method ? [method] : undefined;
}

async function handleMerge(ctx: TrackerContext, args: string[], deps: CommandDeps): Promise<void> {
	const state = deps.getState();
	const ref = getTrackedRef(state);
	if (!ref || !state.pr) return notify(ctx, "No tracked PR. Use /pr track <number|url|branch> first.", "warning");
	const mergeArgs = await resolveMergeArgs(ctx, args);
	if (!mergeArgs || !ctx.hasUI) return;
	const ok = await ctx.ui.confirm(`Merge PR #${state.pr.number}?`, `${state.pr.readiness.label}\n\nCommand: gh pr merge ${ref} ${mergeArgs.join(" ")}`);
	if (!ok) return;
	try {
		await mergePullRequest(deps.exec, ctx.cwd, ref, mergeArgs, ctx.signal);
		notify(ctx, `Merged PR #${state.pr.number}.`, "info");
		await deps.refreshTracked(ctx, ref, state.source, { notify: false });
	} catch (error) {
		notify(ctx, `Merge failed: ${messageOf(error)}`, "error");
	}
}

export function createPrCommandHandler(deps: CommandDeps) {
	return async function handlePrCommand(args: string, ctx: TrackerContext): Promise<void> {
		const parsed = parsePrCommand(args);
		switch (parsed.command) {
			case "help": return notify(ctx, helpText(), "info");
			case "show": {
				const state = deps.getState();
				if (state.pr) return notify(ctx, formatNotification(state), "info");
				await deps.refreshTracked(ctx, undefined, "current branch", { notify: true });
				return;
			}
			case "refresh": await deps.refreshTracked(ctx, parsed.args[0] ?? getTrackedRef(deps.getState()), deps.getState().source, { notify: true }); return;
			case "track": await deps.refreshTracked(ctx, parsed.args[0], "manual", { notify: true }); return;
			case "open": await handleOpen(ctx, deps); return;
			case "merge": await handleMerge(ctx, parsed.args, deps); return;
			case "untrack":
				deps.setState(createEmptyState(), ctx);
				notify(ctx, "PR tracking cleared for this session.", "info");
				return;
		}
	};
}
