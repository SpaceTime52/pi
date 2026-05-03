import { summarizeChecks, summarizeReview } from "./github-checks.js";
import { asBoolean, asNumber, asString, field } from "./github-fields.js";
import { determineReadiness } from "./github-readiness.js";
import { PR_VIEW_FIELDS, type ExecFn, type PullRequestStatus } from "./types.js";

const GH_TIMEOUT_MS = 15_000;
const GH_MERGE_TIMEOUT_MS = 120_000;

export { determineReadiness, summarizeChecks, summarizeReview };

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

function parseGhJson(stdout: string | undefined): PullRequestStatus {
	try {
		return normalizePullRequestStatus(JSON.parse(stdout ?? ""));
	} catch (error) {
		if (error instanceof SyntaxError) throw new Error(`Could not parse gh pr view JSON: ${error.message}`);
		throw error;
	}
}

export async function fetchPullRequestStatus(exec: ExecFn, cwd: string, ref?: string, signal?: AbortSignal): Promise<PullRequestStatus> {
	const args = ["pr", "view"];
	if (ref) args.push(ref);
	args.push("--json", PR_VIEW_FIELDS.join(","));
	const result = await exec("gh", args, { cwd, signal, timeout: GH_TIMEOUT_MS });
	assertSuccess(result, "gh pr view");
	return parseGhJson(result.stdout);
}

export async function openPullRequest(exec: ExecFn, cwd: string, ref: string, signal?: AbortSignal): Promise<void> {
	const result = await exec("gh", ["pr", "view", ref, "--web"], { cwd, signal, timeout: GH_TIMEOUT_MS });
	assertSuccess(result, "gh pr view --web");
}

export async function mergePullRequest(exec: ExecFn, cwd: string, ref: string, mergeArgs: string[], signal?: AbortSignal): Promise<void> {
	const result = await exec("gh", ["pr", "merge", ref, ...mergeArgs], { cwd, signal, timeout: GH_MERGE_TIMEOUT_MS });
	assertSuccess(result, "gh pr merge");
}
