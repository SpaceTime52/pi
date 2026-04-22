import type { ExtensionCommandContext, ExtensionContext } from "@mariozechner/pi-coding-agent";

export type ReviewTab = "branch" | "commits" | "files";
export type ChangeStatus = "modified" | "added" | "deleted" | "renamed";
export type CommitKind = "commit" | "working-tree";

export interface ReviewFile {
	id: string;
	path: string;
	status: ChangeStatus;
	oldPath: string | null;
	newPath: string | null;
	present: boolean;
}

export interface ReviewCommit {
	sha: string;
	shortSha: string;
	subject: string;
	author: string;
	date: string;
	kind: CommitKind;
}

export interface ReviewData {
	repoRoot: string;
	baseRef: string | null;
	mergeBase: string | null;
	hasHead: boolean;
	files: ReviewFile[];
	commits: ReviewCommit[];
}

export interface ReviewDetail {
	title: string;
	content: string;
}

export interface ReviewComment {
	tab: ReviewTab;
	id: string;
	label: string;
	body: string;
}

export interface ReviewSubmitPayload {
	type: "submit";
	overallComment: string;
	comments: ReviewComment[];
}

export type ReviewWindowMessage = ReviewSubmitPayload | { type: "cancel" } | { type: "detail"; requestId: string; tab: ReviewTab; id: string };
export type ReviewHostMessage = { type: "detail-data"; requestId: string; tab: ReviewTab; id: string; title: string; content: string } | { type: "detail-error"; requestId: string; tab: ReviewTab; id: string; message: string };
export type ReviewCommandApi = {
	exec: (command: string, args: string[], options?: { cwd?: string }) => Promise<{ code: number; stdout: string; stderr: string }>;
	registerCommand: (name: string, spec: { description: string; handler: (args: string, ctx: ExtensionCommandContext) => Promise<void> }) => void;
	on: (name: "session_shutdown", handler: (event: object, ctx: ExtensionContext) => void | Promise<void>) => void;
};
