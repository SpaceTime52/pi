import type { PullRequestStatus } from "./pr-types.js";

export const EXTENSION_ID = "pr-tracker";
export const PR_VIEW_FIELDS = ["additions", "baseRefName", "changedFiles", "deletions", "headRefName", "isDraft", "mergeStateStatus", "mergeable", "number", "reviewDecision", "state", "statusCheckRollup", "title", "url"];

export interface TrackerState {
	pr?: PullRequestStatus;
	trackedRef?: string;
	trackedAt?: string;
	source?: string;
	lastError?: string;
	updatedAt?: string;
}

export interface TrackerEntryData {
	version: 1;
	kind: "state";
	state: TrackerState;
}

export interface ExecResult {
	stdout?: string;
	stderr?: string;
	code?: number | null;
	killed?: boolean;
}

export type ExecFn = (
	command: string,
	args: string[],
	options?: { cwd?: string; signal?: AbortSignal; timeout?: number },
) => Promise<ExecResult>;

export interface TrackerUi {
	notify(message: string, level?: "info" | "warning" | "error"): void;
	setWidget(id: string, lines: string[] | undefined): void;
	setStatus(id: string, status: string | undefined): void;
	select(title: string, options: string[]): Promise<string | undefined>;
	confirm(title: string, message: string): Promise<boolean>;
}

export interface TrackerContext {
	cwd: string;
	hasUI: boolean;
	ui: TrackerUi;
	signal?: AbortSignal;
	sessionManager: { getBranch(): unknown[] };
}

export interface ToolResultLike {
	toolName: string;
	isError?: boolean;
	input?: unknown;
	content?: unknown;
}

export interface PrCommandOptions {
	description: string;
	getArgumentCompletions(prefix: string): { value: string; label: string }[];
	handler(args: string, ctx: TrackerContext): Promise<void> | void;
}

export interface PrTrackerPi {
	exec: ExecFn;
	appendEntry(id: string, data: TrackerEntryData): void;
	on(eventName: "session_start", handler: (event: unknown, ctx: TrackerContext) => Promise<void> | void): void;
	on(eventName: "tool_result", handler: (event: ToolResultLike, ctx: TrackerContext) => Promise<void> | void): void;
	registerCommand(name: string, options: PrCommandOptions): void;
}

export type { CheckSummary, PullRequestStatus, ReadinessSummary, ReviewSummary } from "./pr-types.js";
