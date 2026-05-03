export const PR_TYPES_MODULE = "pr-types";
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
	| "ready" | "draft" | "closed" | "merged" | "checks_pending" | "checks_failing"
	| "changes_requested" | "review_required" | "conflicts" | "blocked" | "behind" | "unknown";

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
