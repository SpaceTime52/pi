import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext, ToolResultEvent } from "@mariozechner/pi-coding-agent";
import { helpText, hasMergeMethod, mergeHelpText, parsePrCommand } from "./commands.js";
import { fetchPullRequestStatus, mergePullRequest, openPullRequest } from "./github.js";
import { extractPullRequestRef, extractTextContent, isPullRequestCreationCommand } from "./parser.js";
import { createEmptyState, createErrorState, createTrackedState, reconstructState, serializeState } from "./state.js";
import { EXTENSION_ID, type ExecFn, type TrackerState } from "./types.js";
import { formatNotification, syncTrackerUi } from "./ui.js";

const MERGE_METHODS = ["--merge", "--squash", "--rebase", "--auto"];

function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function notify(ctx: Pick<ExtensionContext, "hasUI" | "ui">, message: string, level: "info" | "warning" | "error" = "info"): void {
	if (ctx.hasUI) ctx.ui.notify(message, level);
}

function getTrackedRef(state: TrackerState): string | undefined {
	return state.trackedRef ?? state.pr?.url ?? (state.pr ? String(state.pr.number) : undefined);
}

export default function (pi: ExtensionAPI) {
	let state = createEmptyState();
	const exec: ExecFn = (command, args, options) => pi.exec(command, args, options);

	function persist(nextState: TrackerState): void {
		pi.appendEntry(EXTENSION_ID, serializeState(nextState));
	}

	function setState(nextState: TrackerState, ctx?: ExtensionContext, shouldPersist = true): void {
		state = nextState;
		if (shouldPersist) persist(state);
		if (ctx) syncTrackerUi(ctx, state);
	}

	async function refreshTracked(
		ctx: ExtensionContext,
		ref: string | undefined,
		source: string | undefined,
		options?: { notify?: boolean },
	): Promise<boolean> {
		try {
			const status = await fetchPullRequestStatus(exec, ctx.cwd, ref, ctx.signal);
			setState(createTrackedState(status, state, { ref, source }), ctx);
			if (options?.notify) notify(ctx, `Tracking ${formatNotification(state)}`, "info");
			return true;
		} catch (error) {
			setState(createErrorState(state, messageOf(error)), ctx);
			if (options?.notify) notify(ctx, `PR refresh failed: ${state.lastError}`, "error");
			return false;
		}
	}

	async function handleToolResult(event: ToolResultEvent, ctx: ExtensionContext): Promise<void> {
		if (event.toolName !== "bash" || event.isError) return;
		const command = typeof event.input === "object" && event.input ? String((event.input as { command?: unknown }).command ?? "") : "";
		if (!isPullRequestCreationCommand(command)) return;
		const output = extractTextContent(event.content);
		const ref = extractPullRequestRef(output)?.ref;
		await refreshTracked(ctx, ref, "gh pr create", { notify: true });
	}

	async function handlePrCommand(args: string, ctx: ExtensionCommandContext): Promise<void> {
		const parsed = parsePrCommand(args);
		switch (parsed.command) {
			case "help":
				notify(ctx, helpText(), "info");
				return;
			case "show":
				if (state.pr) {
					notify(ctx, formatNotification(state), "info");
					return;
				}
				await refreshTracked(ctx, undefined, "current branch", { notify: true });
				return;
			case "refresh": {
				const ref = parsed.args[0] ?? getTrackedRef(state);
				await refreshTracked(ctx, ref, state.source, { notify: true });
				return;
			}
			case "track": {
				const ref = parsed.args[0];
				await refreshTracked(ctx, ref, "manual", { notify: true });
				return;
			}
			case "open": {
				const ref = getTrackedRef(state);
				if (!ref) {
					notify(ctx, "No tracked PR. Use /pr track <number|url|branch> first.", "warning");
					return;
				}
				try {
					await openPullRequest(exec, ctx.cwd, ref, ctx.signal);
					notify(ctx, `Opened PR ${state.pr ? `#${state.pr.number}` : ref}.`, "info");
				} catch (error) {
					notify(ctx, `Could not open PR: ${messageOf(error)}`, "error");
				}
				return;
			}
			case "merge": {
				const ref = getTrackedRef(state);
				if (!ref || !state.pr) {
					notify(ctx, "No tracked PR. Use /pr track <number|url|branch> first.", "warning");
					return;
				}

				let mergeArgs = parsed.args;
				if (mergeArgs.length === 0) {
					if (!ctx.hasUI) {
						notify(ctx, mergeHelpText(), "warning");
						return;
					}
					const method = await ctx.ui.select("Merge method", MERGE_METHODS);
					if (!method) return;
					mergeArgs = [method];
				} else if (!hasMergeMethod(mergeArgs)) {
					notify(ctx, mergeHelpText(), "warning");
					return;
				}

				if (!ctx.hasUI) return;
				const ok = await ctx.ui.confirm(
					`Merge PR #${state.pr.number}?`,
					`${state.pr.readiness.label}\n\nCommand: gh pr merge ${ref} ${mergeArgs.join(" ")}`,
				);
				if (!ok) return;

				try {
					await mergePullRequest(exec, ctx.cwd, ref, mergeArgs, ctx.signal);
					notify(ctx, `Merged PR #${state.pr.number}.`, "info");
					await refreshTracked(ctx, ref, state.source, { notify: false });
				} catch (error) {
					notify(ctx, `Merge failed: ${messageOf(error)}`, "error");
				}
				return;
			}
			case "untrack":
				setState(createEmptyState(), ctx);
				notify(ctx, "PR tracking cleared for this session.", "info");
				return;
		}
	}

	pi.on("session_start", async (_event, ctx) => {
		state = reconstructState(ctx.sessionManager.getBranch());
		syncTrackerUi(ctx, state);
		const ref = getTrackedRef(state);
		if (ref) void refreshTracked(ctx, ref, state.source, { notify: false });
	});

	pi.on("tool_result", handleToolResult);

	pi.registerCommand("pr", {
		description: "Track and manage the pull request associated with this pi session",
		getArgumentCompletions(prefix: string) {
			const commands = ["show", "refresh", "track", "open", "merge", "untrack", "help"];
			return commands.filter((command) => command.startsWith(prefix)).map((command) => ({ value: command, label: command }));
		},
		handler: handlePrCommand,
	});
}
