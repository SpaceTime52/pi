import type { NestedRunSnapshot } from "./types.js";

const activity = new Map<number, string>();
const lastEvent = new Map<number, number>();
const nested = new Map<number, NestedRunSnapshot[]>();

export const getActivity = (runId: number) => activity.get(runId);
export const getLastEventTime = (runId: number) => lastEvent.get(runId);
export const getNestedRuns = (runId: number) => nested.get(runId) ?? [];

export function setActivity(runId: number, value: string | undefined): void {
	lastEvent.set(runId, Date.now());
	if (value) activity.set(runId, value);
	else activity.delete(runId);
}

export function setNestedRunsState(runId: number, runs: NestedRunSnapshot[] | undefined): void {
	if (!runs?.length) { nested.delete(runId); return; }
	nested.set(runId, runs.map((run) => ({ ...run })));
}

export const clearNestedRunsState = (runId: number) => void nested.delete(runId);

export function clearToolStateState(runId: number): void {
	activity.delete(runId);
	lastEvent.delete(runId);
}

export function resetWidgetStore(): void {
	activity.clear();
	lastEvent.clear();
	nested.clear();
}
