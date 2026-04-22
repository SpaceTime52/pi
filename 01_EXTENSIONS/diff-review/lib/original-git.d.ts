import type { ReviewCommandApi, ReviewCommitInfo, ReviewFile, ReviewFileContents, ReviewScope } from "../src/types.js";

export function getRepoRoot(pi: Pick<ReviewCommandApi, "exec">, cwd: string): Promise<string>;
export function getReviewWindowData(pi: Pick<ReviewCommandApi, "exec">, cwd: string): Promise<{ repoRoot: string; files: ReviewFile[]; commits: ReviewCommitInfo[]; branchBaseRef: string | null; branchMergeBaseSha: string | null; repositoryHasHead: boolean; }>;
export function listRangeCommits(pi: Pick<ReviewCommandApi, "exec">, repoRoot: string, range: string, limit: number): Promise<ReviewCommitInfo[]>;
export function getCommitFiles(pi: Pick<ReviewCommandApi, "exec">, repoRoot: string, sha: string): Promise<ReviewFile[]>;
export function loadReviewFileContents(pi: Pick<ReviewCommandApi, "exec">, repoRoot: string, file: ReviewFile, scope: ReviewScope, commitSha?: string | null, branchMergeBaseSha?: string | null): Promise<ReviewFileContents>;
export function isWorkingTreeCommitSha(sha: string): boolean;
