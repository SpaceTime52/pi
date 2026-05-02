import { PR_VIEW_FIELDS, type CheckSummary, type ExecFn, type PullRequestStatus, type ReadinessSummary, type ReviewSummary } from "./types.js";

const GH_TIMEOUT_MS = 15_000;
const GH_MERGE_TIMEOUT_MS = 120_000;

function asString(value: unknown): string | undefined {
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
	return typeof value === "boolean" ? value : undefined;
}

function field(record: unknown, key: string): unknown {
	return record && typeof record === "object" ? (record as Record<string, unknown>)[key] : undefined;
}

function normalizeCheckItem(item: unknown): "passed" | "pending" | "failed" | "unknown" {
	const conclusion = asString(field(item, "conclusion"))?.toUpperCase();
	const status = asString(field(item, "status"))?.toUpperCase();
	const state = asString(field(item, "state"))?.toUpperCase();

	if (["FAILURE", "FAILED", "ERROR", "TIMED_OUT", "CANCELLED", "ACTION_REQUIRED", "STARTUP_FAILURE"].includes(conclusion ?? "")) {
		return "failed";
	}
	if (["SUCCESS", "SKIPPED", "NEUTRAL"].includes(conclusion ?? "")) return "passed";
	if (["FAILURE", "FAILED", "ERROR"].includes(state ?? "")) return "failed";
	if (state === "SUCCESS") return "passed";
	if (status && status !== "COMPLETED") return "pending";
	if (status === "COMPLETED" && !conclusion) return "unknown";
	if (state && !["SUCCESS", "FAILURE", "FAILED", "ERROR"].includes(state)) return "pending";
	return "unknown";
}

export function summarizeChecks(rollup: unknown): CheckSummary {
	if (!Array.isArray(rollup) || rollup.length === 0) {
		return { state: "none", total: 0, passed: 0, pending: 0, failed: 0 };
	}

	let passed = 0;
	let pending = 0;
	let failed = 0;
	let unknown = 0;
	for (const item of rollup) {
		switch (normalizeCheckItem(item)) {
			case "passed":
				passed += 1;
				break;
			case "pending":
				pending += 1;
				break;
			case "failed":
				failed += 1;
				break;
			case "unknown":
				unknown += 1;
				break;
		}
	}

	const state = failed > 0 ? "failing" : pending > 0 ? "pending" : unknown > 0 ? "unknown" : "passing";
	return { state, total: rollup.length, passed, pending, failed };
}

export function summarizeReview(decision: unknown): ReviewSummary {
	const normalized = asString(decision)?.toUpperCase();
	switch (normalized) {
		case "APPROVED":
			return { state: "approved", label: "Review approved", decision: normalized };
		case "CHANGES_REQUESTED":
			return { state: "changes_requested", label: "Changes requested", decision: normalized };
		case "REVIEW_REQUIRED":
			return { state: "required", label: "Review required", decision: normalized };
		case undefined:
		case "":
			return { state: "none", label: "No review rule" };
		default:
			return { state: "unknown", label: `Review ${normalized.toLowerCase()}`, decision: normalized };
	}
}

export function determineReadiness(raw: unknown, checks: CheckSummary, review: ReviewSummary): ReadinessSummary {
	const state = asString(field(raw, "state"))?.toUpperCase();
	const mergeable = asString(field(raw, "mergeable"))?.toUpperCase();
	const mergeStateStatus = asString(field(raw, "mergeStateStatus"))?.toUpperCase();
	const isDraft = asBoolean(field(raw, "isDraft"));

	if (state === "MERGED") return { state: "merged", label: "Merged" };
	if (state === "CLOSED") return { state: "closed", label: "Closed" };
	if (isDraft) return { state: "draft", label: "Draft" };
	if (mergeable === "CONFLICTING" || mergeStateStatus === "DIRTY") return { state: "conflicts", label: "Conflicts" };
	if (checks.state === "failing") return { state: "checks_failing", label: "Checks failing" };
	if (checks.state === "pending") return { state: "checks_pending", label: "Checks pending" };
	if (review.state === "changes_requested") return { state: "changes_requested", label: "Changes requested" };
	if (review.state === "required") return { state: "review_required", label: "Review required" };
	if (mergeStateStatus === "BEHIND") return { state: "behind", label: "Behind base" };
	if (["BLOCKED", "UNSTABLE", "HAS_HOOKS"].includes(mergeStateStatus ?? "")) return { state: "blocked", label: "Blocked" };
	if (checks.state === "unknown" || mergeable === "UNKNOWN" || mergeStateStatus === "UNKNOWN") return { state: "unknown", label: "Open" };
	return { state: "ready", label: "Ready to merge" };
}

export function normalizePullRequestStatus(raw: unknown, now = () => new Date().toISOString()): PullRequestStatus {
	const number = asNumber(field(raw, "number"));
	if (number === undefined) throw new Error("GitHub response did not include a PR number");
	const checks = summarizeChecks(field(raw, "statusCheckRollup"));
	const review = summarizeReview(field(raw, "reviewDecision"));
	return {
		number,
		url: asString(field(raw, "url")),
		title: asString(field(raw, "title")),
		state: asString(field(raw, "state")),
		isDraft: asBoolean(field(raw, "isDraft")),
		mergeable: asString(field(raw, "mergeable")),
		mergeStateStatus: asString(field(raw, "mergeStateStatus")),
		reviewDecision: asString(field(raw, "reviewDecision")),
		changedFiles: asNumber(field(raw, "changedFiles")),
		additions: asNumber(field(raw, "additions")),
		deletions: asNumber(field(raw, "deletions")),
		headRefName: asString(field(raw, "headRefName")),
		baseRefName: asString(field(raw, "baseRefName")),
		checks,
		review,
		readiness: determineReadiness(raw, checks, review),
		updatedAt: now(),
	};
}

function assertSuccess(result: Awaited<ReturnType<ExecFn>>, action: string): void {
	if (result.code === undefined || result.code === 0) return;
	const message = result.stderr || result.stdout || `${action} failed with exit code ${result.code}`;
	throw new Error(message.trim());
}

export async function fetchPullRequestStatus(
	exec: ExecFn,
	cwd: string,
	ref?: string,
	signal?: AbortSignal,
): Promise<PullRequestStatus> {
	const args = ["pr", "view"];
	if (ref) args.push(ref);
	args.push("--json", PR_VIEW_FIELDS.join(","));
	const result = await exec("gh", args, { cwd, signal, timeout: GH_TIMEOUT_MS });
	assertSuccess(result, "gh pr view");
	try {
		return normalizePullRequestStatus(JSON.parse(result.stdout ?? ""));
	} catch (error) {
		if (error instanceof SyntaxError) throw new Error(`Could not parse gh pr view JSON: ${error.message}`);
		throw error;
	}
}

export async function openPullRequest(exec: ExecFn, cwd: string, ref: string, signal?: AbortSignal): Promise<void> {
	const result = await exec("gh", ["pr", "view", ref, "--web"], { cwd, signal, timeout: GH_TIMEOUT_MS });
	assertSuccess(result, "gh pr view --web");
}

export async function mergePullRequest(
	exec: ExecFn,
	cwd: string,
	ref: string,
	mergeArgs: string[],
	signal?: AbortSignal,
): Promise<void> {
	const result = await exec("gh", ["pr", "merge", ref, ...mergeArgs], { cwd, signal, timeout: GH_MERGE_TIMEOUT_MS });
	assertSuccess(result, "gh pr merge");
}
