import { ENTRY_TYPE } from "./constants.js";

export interface TerseModeEntry {
	enabled: boolean;
	updatedAt: number;
}

export interface BranchEntryLike {
	type?: string;
	customType?: string;
	data?: unknown;
}

let enabled = true;

export function isEnabled(): boolean {
	return enabled;
}

export function setEnabled(next: boolean): boolean {
	const changed = enabled !== next;
	enabled = next;
	return changed;
}

export function resetState(): void {
	enabled = true;
}

export function buildEntry(updatedAt: number = Date.now()): TerseModeEntry {
	return { enabled, updatedAt };
}

export function restoreFromEntries(entries: BranchEntryLike[]): boolean {
	enabled = true;
	for (let i = entries.length - 1; i >= 0; i -= 1) {
		const entry = entries[i];
		if (entry.type !== "custom" || entry.customType !== ENTRY_TYPE) continue;
		const restored = readEnabled(entry.data);
		if (restored === undefined) continue;
		enabled = restored;
		return enabled;
	}
	return enabled;
}

function readEnabled(value: unknown): boolean | undefined {
	if (!isRecord(value)) return undefined;
	return typeof value.enabled === "boolean" ? value.enabled : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
