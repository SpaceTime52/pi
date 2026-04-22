import type { ChangeStatus, ReviewFile } from "../src/types.js";

function isReviewablePath(path: string): boolean {
	const lower = path.toLowerCase();
	return !lower.endsWith(".min.js") && !lower.endsWith(".min.css");
}

function toStatus(code: string): ChangeStatus | null {
	if (code === "M") return "modified";
	if (code === "A") return "added";
	if (code === "D") return "deleted";
	if (code === "R") return "renamed";
	return null;
}

export function parseNameStatus(output: string): ReviewFile[] {
	return output
		.split(/\r?\n/u)
		.map((line) => line.trim())
		.filter(Boolean)
		.flatMap((line) => {
			const [rawCode, first, second] = line.split("\t");
			const status = toStatus((rawCode ?? "")[0] ?? "");
			const path = status === "renamed" ? second ?? "" : first ?? "";
			if (!status || !path || !isReviewablePath(path)) return [];
			return [{
				id: `${status}:${first ?? ""}:${second ?? ""}`,
				path,
				status,
				oldPath: status === "added" ? null : first ?? null,
				newPath: status === "deleted" ? null : status === "renamed" ? second ?? null : first ?? null,
				present: status !== "deleted",
			} satisfies ReviewFile];
		})
		.sort((a, b) => a.path.localeCompare(b.path));
}
