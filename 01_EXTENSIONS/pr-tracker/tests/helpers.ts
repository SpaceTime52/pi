import { vi } from "vitest";
import type { ExecFn, TrackerContext, TrackerState } from "../src/types.ts";

export const rawPr = {
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
	statusCheckRollup: [{ status: "COMPLETED", conclusion: "SUCCESS" }],
};

export function createContext(hasUI = true): TrackerContext {
	return {
		cwd: "/repo",
		hasUI,
		ui: { notify: vi.fn(), setWidget: vi.fn(), setStatus: vi.fn(), select: vi.fn(), confirm: vi.fn() },
		sessionManager: { getBranch: () => [] },
	};
}

export function createExec(stdout = JSON.stringify(rawPr), code = 0): ExecFn {
	return vi.fn(async () => ({ stdout, code }));
}

export function trackedState(): TrackerState {
	return {
		pr: {
			number: 63,
			url: rawPr.url,
			checks: { state: "passing", total: 1, passed: 1, pending: 0, failed: 0 },
			review: { state: "approved", label: "Review approved" },
			readiness: { state: "ready", label: "Ready to merge" },
			updatedAt: "now",
		},
		trackedRef: rawPr.url,
		source: "manual",
	};
}
