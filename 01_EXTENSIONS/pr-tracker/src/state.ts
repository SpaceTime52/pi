import { EXTENSION_ID, type PullRequestStatus, type TrackerEntryData, type TrackerState } from "./types.js";

function cloneState(state: TrackerState): TrackerState {
	return JSON.parse(JSON.stringify(state)) as TrackerState;
}

export function createEmptyState(): TrackerState {
	return {};
}

export function serializeState(state: TrackerState): TrackerEntryData {
	return { version: 1, kind: "state", state: cloneState(state) };
}

export function isTrackerEntryData(value: unknown): value is TrackerEntryData {
	if (!value || typeof value !== "object") return false;
	const record = value as Partial<TrackerEntryData>;
	return record.version === 1 && record.kind === "state" && typeof record.state === "object" && record.state !== null;
}

export function reconstructState(entries: unknown[]): TrackerState {
	let state = createEmptyState();
	for (const entry of entries) {
		if (!entry || typeof entry !== "object") continue;
		const record = entry as { type?: string; customType?: string; data?: unknown };
		if (record.type !== "custom" || record.customType !== EXTENSION_ID) continue;
		if (isTrackerEntryData(record.data)) state = cloneState(record.data.state);
	}
	return state;
}

export function createTrackedState(
	status: PullRequestStatus,
	previous: TrackerState,
	options?: { ref?: string; source?: string; now?: () => string },
): TrackerState {
	const now = options?.now ?? (() => new Date().toISOString());
	const trackedAt = previous.trackedAt ?? now();
	const trackedRef = status.url ?? options?.ref ?? previous.trackedRef ?? String(status.number);
	return {
		...previous,
		pr: status,
		trackedRef,
		trackedAt,
		source: options?.source ?? previous.source,
		lastError: undefined,
		updatedAt: status.updatedAt,
	};
}

export function createErrorState(previous: TrackerState, message: string, now = () => new Date().toISOString()): TrackerState {
	return { ...previous, lastError: message, updatedAt: now() };
}
