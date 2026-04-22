import type { ReviewComment, ReviewSubmitPayload } from "./types.js";

function formatLabel(comment: ReviewComment): string {
	if (comment.tab === "branch") return `[branch diff] ${comment.label}`;
	if (comment.tab === "commits") return `[commit] ${comment.label}`;
	return `[current file] ${comment.label}`;
}

export function hasReviewFeedback(payload: ReviewSubmitPayload): boolean {
	return payload.overallComment.trim().length > 0 || payload.comments.some((comment) => comment.body.trim().length > 0);
}

export function composeReviewPrompt(payload: ReviewSubmitPayload): string {
	const lines = ["Please address the following diff review feedback", ""];
	const overall = payload.overallComment.trim();
	if (overall) lines.push(overall, "");
	payload.comments.filter((comment) => comment.body.trim()).forEach((comment, index) => {
		lines.push(`${index + 1}. ${formatLabel(comment)}`);
		lines.push(`   ${comment.body.trim()}`);
		lines.push("");
	});
	return lines.join("\n").trim();
}
