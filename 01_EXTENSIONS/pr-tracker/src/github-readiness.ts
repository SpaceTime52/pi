import { asBoolean, asString, field } from "./github-fields.js";
import type { CheckSummary, ReadinessSummary, ReviewSummary } from "./pr-types.js";

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
