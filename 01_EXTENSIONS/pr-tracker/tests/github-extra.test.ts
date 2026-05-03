import { describe, expect, it, vi } from "vitest";
import { determineReadiness, fetchPullRequestStatus, mergePullRequest, normalizePullRequestStatus, openPullRequest, summarizeChecks, summarizeReview } from "../src/github.ts";
import { asBoolean, asNumber, asString, field } from "../src/github-fields.ts";
import { PR_TYPES_MODULE } from "../src/pr-types.ts";
import { createExec, rawPr } from "./helpers.ts";

describe("github edge cases", () => {
	it("normalizes primitive fields defensively", () => {
		expect(PR_TYPES_MODULE).toBe("pr-types");
		expect(asString("x")).toBe("x");
		expect(asString("")).toBeUndefined();
		expect(asNumber(1)).toBe(1);
		expect(asNumber(Number.NaN)).toBeUndefined();
		expect(asBoolean(false)).toBe(false);
		expect(asBoolean("false")).toBeUndefined();
		expect(field({ a: 1 }, "a")).toBe(1);
		expect(field(null, "a")).toBeUndefined();
	});

	it("covers check and review states", () => {
		expect(summarizeChecks([{}]).state).toBe("unknown");
		expect(summarizeChecks([{ status: "COMPLETED" }]).state).toBe("unknown");
		expect(summarizeChecks([{ state: "QUEUED" }]).state).toBe("pending");
		expect(summarizeChecks([{ conclusion: "SKIPPED" }, { state: "ERROR" }])).toMatchObject({ passed: 1, failed: 1 });
		expect(summarizeReview(undefined).state).toBe("none");
		expect(summarizeReview("").state).toBe("none");
		expect(summarizeReview("CHANGES_REQUESTED").state).toBe("changes_requested");
		expect(summarizeReview("REVIEW_REQUIRED").state).toBe("required");
		expect(summarizeReview("COMMENTED")).toMatchObject({ state: "unknown", decision: "COMMENTED" });
	});

	it("covers readiness priorities", () => {
		const checks = summarizeChecks([{ conclusion: "SUCCESS" }]);
		const approved = summarizeReview("APPROVED");
		expect(determineReadiness({ state: "MERGED" }, checks, approved).state).toBe("merged");
		expect(determineReadiness({ state: "CLOSED" }, checks, approved).state).toBe("closed");
		expect(determineReadiness({ mergeStateStatus: "DIRTY" }, checks, approved).state).toBe("conflicts");
		expect(determineReadiness({ mergeStateStatus: "BEHIND" }, checks, approved).state).toBe("behind");
		expect(determineReadiness({ mergeStateStatus: "BLOCKED" }, checks, approved).state).toBe("blocked");
		expect(determineReadiness({ mergeable: "UNKNOWN" }, checks, approved).state).toBe("unknown");
		expect(determineReadiness(rawPr, { state: "pending", total: 1, passed: 0, pending: 1, failed: 0 }, approved).state).toBe("checks_pending");
		expect(determineReadiness(rawPr, checks, summarizeReview("CHANGES_REQUESTED")).state).toBe("changes_requested");
		expect(determineReadiness(rawPr, checks, summarizeReview("REVIEW_REQUIRED")).state).toBe("review_required");
	});

	it("reports invalid gh data", async () => {
		expect(() => normalizePullRequestStatus({})).toThrow("PR number");
		await expect(fetchPullRequestStatus(createExec("not-json"), "/repo", "63")).rejects.toThrow("Could not parse");
		await expect(fetchPullRequestStatus(vi.fn(async () => ({ code: 0 })), "/repo", "63")).rejects.toThrow("Could not parse");
		await expect(fetchPullRequestStatus(createExec("{}"), "/repo", "63")).rejects.toThrow("PR number");
	});

	it("opens and merges pull requests", async () => {
		const exec = vi.fn(async () => ({ code: 0 }));
		await openPullRequest(exec, "/repo", "63");
		expect(exec).toHaveBeenCalledWith("gh", ["pr", "view", "63", "--web"], { cwd: "/repo", signal: undefined, timeout: 15000 });
		await mergePullRequest(exec, "/repo", "63", ["--squash"]);
		expect(exec).toHaveBeenLastCalledWith("gh", ["pr", "merge", "63", "--squash"], { cwd: "/repo", signal: undefined, timeout: 120000 });
	});

	it("uses stdout or exit code in gh failure messages", async () => {
		await expect(openPullRequest(createExec("bad", 1), "/repo", "63")).rejects.toThrow("bad");
		await expect(mergePullRequest(vi.fn(async () => ({ code: 2 })), "/repo", "63", ["--merge"])).rejects.toThrow("exit code 2");
	});
});
