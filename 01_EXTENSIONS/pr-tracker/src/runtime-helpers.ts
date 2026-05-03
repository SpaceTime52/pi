import { field } from "./github-fields.js";
import type { TrackerContext, TrackerState } from "./types.js";

export const MERGE_METHODS = ["--merge", "--squash", "--rebase", "--auto"];

export function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export function notify(ctx: Pick<TrackerContext, "hasUI" | "ui">, message: string, level: "info" | "warning" | "error" = "info"): void {
	if (ctx.hasUI) ctx.ui.notify(message, level);
}

export function getTrackedRef(state: TrackerState): string | undefined {
	return state.trackedRef ?? state.pr?.url ?? (state.pr ? String(state.pr.number) : undefined);
}

export function commandFromInput(input: unknown): string {
	const command = field(input, "command");
	return typeof command === "string" ? command : "";
}
