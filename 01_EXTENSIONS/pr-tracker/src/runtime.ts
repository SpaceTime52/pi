import { createPrCommandHandler } from "./pr-actions.js";
import { fetchPullRequestStatus } from "./github.js";
import { extractPullRequestRef, extractTextContent, isPullRequestCreationCommand } from "./parser.js";
import { createEmptyState, createErrorState, createTrackedState, reconstructState, serializeState } from "./state.js";
import { EXTENSION_ID, type ExecFn, type PrTrackerPi, type ToolResultLike, type TrackerContext, type TrackerState } from "./types.js";
import { formatNotification, syncTrackerUi } from "./ui.js";
import { commandFromInput, getTrackedRef, messageOf, notify } from "./runtime-helpers.js";

const COMMANDS = ["show", "refresh", "track", "open", "merge", "untrack", "help"];

export default function registerPrTracker(pi: PrTrackerPi): void {
	let state = createEmptyState();
	const exec: ExecFn = (command, args, options) => pi.exec(command, args, options);

	function persist(nextState: TrackerState): void {
		pi.appendEntry(EXTENSION_ID, serializeState(nextState));
	}

	function setState(nextState: TrackerState, ctx?: TrackerContext, shouldPersist = true): void {
		state = nextState;
		if (shouldPersist) persist(state);
		if (ctx) syncTrackerUi(ctx, state);
	}

	async function refreshTracked(ctx: TrackerContext, ref: string | undefined, source: string | undefined, options?: { notify?: boolean }): Promise<boolean> {
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

	async function handleToolResult(event: ToolResultLike, ctx: TrackerContext): Promise<void> {
		if (event.toolName !== "bash" || event.isError) return;
		if (!isPullRequestCreationCommand(commandFromInput(event.input))) return;
		const ref = extractPullRequestRef(extractTextContent(event.content))?.ref;
		await refreshTracked(ctx, ref, "gh pr create", { notify: true });
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
		getArgumentCompletions: (prefix) => COMMANDS.filter((command) => command.startsWith(prefix)).map((command) => ({ value: command, label: command })),
		handler: createPrCommandHandler({ exec, getState: () => state, setState, refreshTracked }),
	});
}
