import { asString, field } from "./github-fields.js";
import type { CheckSummary, ReviewSummary } from "./pr-types.js";

type CheckItemState = "passed" | "pending" | "failed" | "unknown";

function normalizeCheckItem(item: unknown): CheckItemState {
	const conclusion = asString(field(item, "conclusion"))?.toUpperCase();
	const status = asString(field(item, "status"))?.toUpperCase();
	const state = asString(field(item, "state"))?.toUpperCase();
	if (["FAILURE", "FAILED", "ERROR", "TIMED_OUT", "CANCELLED", "ACTION_REQUIRED", "STARTUP_FAILURE"].includes(conclusion ?? "")) return "failed";
	if (["SUCCESS", "SKIPPED", "NEUTRAL"].includes(conclusion ?? "")) return "passed";
	if (["FAILURE", "FAILED", "ERROR"].includes(state ?? "")) return "failed";
	if (state === "SUCCESS") return "passed";
	if (status && status !== "COMPLETED") return "pending";
	if (status === "COMPLETED" && !conclusion) return "unknown";
	if (state && !["SUCCESS", "FAILURE", "FAILED", "ERROR"].includes(state)) return "pending";
	return "unknown";
}

export function summarizeChecks(rollup: unknown): CheckSummary {
	if (!Array.isArray(rollup) || rollup.length === 0) return { state: "none", total: 0, passed: 0, pending: 0, failed: 0 };
	let passed = 0;
	let pending = 0;
	let failed = 0;
	let unknown = 0;
	for (const item of rollup) {
		switch (normalizeCheckItem(item)) {
			case "passed": passed += 1; break;
			case "pending": pending += 1; break;
			case "failed": failed += 1; break;
			case "unknown": unknown += 1; break;
		}
	}
	const state = failed > 0 ? "failing" : pending > 0 ? "pending" : unknown > 0 ? "unknown" : "passing";
	return { state, total: rollup.length, passed, pending, failed };
}

export function summarizeReview(decision: unknown): ReviewSummary {
	const normalized = asString(decision)?.toUpperCase();
	switch (normalized) {
		case "APPROVED": return { state: "approved", label: "Review approved", decision: normalized };
		case "CHANGES_REQUESTED": return { state: "changes_requested", label: "Changes requested", decision: normalized };
		case "REVIEW_REQUIRED": return { state: "required", label: "Review required", decision: normalized };
		case undefined:
		case "": return { state: "none", label: "No review rule" };
		default: return { state: "unknown", label: `Review ${normalized.toLowerCase()}`, decision: normalized };
	}
}
