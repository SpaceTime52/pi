export const EXTENSION_ID = "pr-tracker";

export const PR_VIEW_FIELDS = [
	"additions",
	"baseRefName",
	"changedFiles",
	"deletions",
	"headRefName",
	"isDraft",
	"mergeStateStatus",
	"mergeable",
	"number",
	"reviewDecision",
	"state",
	"statusCheckRollup",
	"title",
	"url",
] as const;

export type CheckState = "none" | "passing" | "pending" | "failing" | "unknown";

export interface CheckSummary {
	state: CheckState;
	total: number;
	passed: number;
	pending: number;
	failed: number;
}

export type ReviewState = "approved" | "changes_requested" | "required" | "none" | "unknown";

export interface ReviewSummary {
	state: ReviewState;
	label: string;
	decision?: string;
}

export type ReadinessState =
	| "ready"
	| "draft"
	| "closed"
	| "merged"
	| "checks_pending"
	| "checks_failing"
	| "changes_requested"
	| "review_required"
	| "conflicts"
	| "blocked"
	| "behind"
	| "unknown";

export interface ReadinessSummary {
	state: ReadinessState;
	label: string;
}

export interface PullRequestStatus {
	number: number;
	url?: string;
	title?: string;
	state?: string;
	isDraft?: boolean;
	mergeable?: string;
	mergeStateStatus?: string;
	reviewDecision?: string;
	changedFiles?: number;
	additions?: number;
	deletions?: number;
	headRefName?: string;
	baseRefName?: string;
	checks: CheckSummary;
	review: ReviewSummary;
	readiness: ReadinessSummary;
	updatedAt: string;
}

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
