export const MAX_ACTIVITY_CHARS = 2_500;
export const MAX_SUMMARY_CHARS = 24;

type ContentBlock = {
	type?: string;
	text?: string;
	name?: string;
	arguments?: Record<string, unknown>;
};

type BranchEntry = {
	type?: string;
	message?: {
		role?: string;
		content?: unknown;
	};
};

// Pull just enough recent context to summarize what the session is doing right
// now. Bounded by MAX_ACTIVITY_CHARS so summarization stays fast and cheap.
export function extractActivityText(branch: readonly BranchEntry[]): string {
	const recent = branch.slice(-6);
	const parts: string[] = [];

	for (const entry of recent) {
		if (entry.type !== "message" || !entry.message) continue;
		const role = entry.message.role;
		if (role !== "user" && role !== "assistant" && role !== "toolResult") continue;

		const content = entry.message.content;
		if (typeof content === "string") {
			parts.push(`${role}: ${content.slice(0, 600)}`);
			continue;
		}
		if (!Array.isArray(content)) continue;

		for (const part of content) {
			if (!part || typeof part !== "object") continue;
			const block = part as ContentBlock;
			if (block.type === "text" && typeof block.text === "string") {
				parts.push(`${role}: ${block.text.slice(0, 600)}`);
			} else if (block.type === "toolCall" && typeof block.name === "string") {
				const args = JSON.stringify(block.arguments ?? {});
				parts.push(`${role} tool=${block.name} args=${args.slice(0, 200)}`);
			}
		}
	}

	const joined = parts.join("\n").trim();
	if (joined.length <= MAX_ACTIVITY_CHARS) return joined;
	return joined.slice(joined.length - MAX_ACTIVITY_CHARS);
}

// Force the LLM output into a single line ≤ MAX_SUMMARY_CHARS code points,
// stripping decorative quoting/punctuation so it lands cleanly in the title bar.
export function trimSummary(raw: string): string {
	const nl = raw.indexOf("\n");
	const firstLine = (nl >= 0 ? raw.slice(0, nl) : raw).trim();
	const stripped = firstLine.replace(/^[\s"'`。.]+|[\s"'`。.]+$/g, "");
	return Array.from(stripped).slice(0, MAX_SUMMARY_CHARS).join("");
}
