import { describe, expect, it, vi } from "vitest";
import { fetchPullRequestStatus, normalizePullRequestStatus, summarizeChecks } from "../src/github.ts";
import type { ExecFn } from "../src/types.ts";

const baseRaw = {
	number: 63,
	url: "https://github.com/acme/web/pull/63",
	title: "Add PR tracker",
	state: "OPEN",
	isDraft: false,
	mergeable: "MERGEABLE",
	mergeStateStatus: "CLEAN",
	reviewDecision: "APPROVED",
	changedFiles: 1,
	additions: 10,
	deletions: 2,
	headRefName: "feature/pr-tracker",
	baseRefName: "main",
	statusCheckRollup: [
		{ status: "COMPLETED", conclusion: "SUCCESS" },
		{ state: "SUCCESS" },
	],
};

describe("github", () => {
	it("summarizes check rollups", () => {
		expect(summarizeChecks([])).toEqual({ state: "none", total: 0, passed: 0, pending: 0, failed: 0 });
		expect(summarizeChecks([{ status: "IN_PROGRESS" }, { conclusion: "FAILURE" }])).toMatchObject({
			state: "failing",
			pending: 1,
			failed: 1,
		});
	});

	it("normalizes ready pull request status", () => {
		const status = normalizePullRequestStatus(baseRaw, () => "now");
		expect(status).toMatchObject({
			number: 63,
			checks: { state: "passing", total: 2, passed: 2 },
			review: { state: "approved" },
			readiness: { state: "ready", label: "Ready to merge" },
			updatedAt: "now",
		});
	});

	it("prioritizes blocking readiness states", () => {
		expect(normalizePullRequestStatus({ ...baseRaw, isDraft: true }).readiness.state).toBe("draft");
		expect(normalizePullRequestStatus({ ...baseRaw, mergeable: "CONFLICTING" }).readiness.state).toBe("conflicts");
		expect(
			normalizePullRequestStatus({ ...baseRaw, statusCheckRollup: [{ status: "COMPLETED", conclusion: "FAILURE" }] }).readiness.state,
		).toBe("checks_failing");
	});

	it("fetches PR status using gh", async () => {
		const exec = vi.fn(async () => ({ stdout: JSON.stringify(baseRaw), code: 0 })) as ExecFn;
		const status = await fetchPullRequestStatus(exec, "/repo", "63");
		expect(exec).toHaveBeenCalledWith("gh", ["pr", "view", "63", "--json", expect.stringContaining("statusCheckRollup")], {
			cwd: "/repo",
			signal: undefined,
			timeout: 15000,
		});
		expect(status.number).toBe(63);
	});

	it("reports gh failures", async () => {
		const exec = vi.fn(async () => ({ stderr: "not found", code: 1 })) as ExecFn;
		await expect(fetchPullRequestStatus(exec, "/repo", "63")).rejects.toThrow("not found");
	});
});
