export interface PullRequestRef {
	ref: string;
	number?: number;
	url?: string;
	owner?: string;
	repo?: string;
}

const PULL_URL_RE = /https:\/\/github\.com\/([^/\s)]+)\/([^/\s)]+)\/pull\/(\d+)/i;
const PULL_REQUEST_NUMBER_RE = /(?:pull request|pr)\s*#(\d+)/i;

export function extractTextContent(content: unknown): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content
		.map((block) => {
			if (!block || typeof block !== "object") return "";
			const value = block as { type?: string; text?: unknown };
			return value.type === "text" && typeof value.text === "string" ? value.text : "";
		})
		.filter(Boolean)
		.join("\n");
}

export function extractPullRequestRef(text: string): PullRequestRef | undefined {
	const urlMatch = text.match(PULL_URL_RE);
	if (urlMatch) {
		const [, owner, repo, numberText] = urlMatch;
		const url = `https://github.com/${owner}/${repo}/pull/${numberText}`;
		return { ref: url, url, owner, repo, number: Number(numberText) };
	}

	const numberMatch = text.match(PULL_REQUEST_NUMBER_RE);
	if (numberMatch) {
		const number = Number(numberMatch[1]);
		return { ref: String(number), number };
	}

	return undefined;
}

export function isPullRequestCreationCommand(command: string): boolean {
	return /(?:^|[\s;&|()])gh\s+pr\s+create(?:\s|$)/.test(command);
}

export function isPullRequestViewCommand(command: string): boolean {
	return /(?:^|[\s;&|()])gh\s+pr\s+view(?:\s|$)/.test(command);
}

export function splitArgs(input: string): string[] {
	const args: string[] = [];
	let current = "";
	let quote: '"' | "'" | undefined;
	let escaping = false;

	for (const char of input) {
		if (escaping) {
			current += char;
			escaping = false;
			continue;
		}
		if (char === "\\" && quote !== "'") {
			escaping = true;
			continue;
		}
		if ((char === '"' || char === "'") && quote === undefined) {
			quote = char;
			continue;
		}
		if (quote === char) {
			quote = undefined;
			continue;
		}
		if (/\s/.test(char) && quote === undefined) {
			if (current) {
				args.push(current);
				current = "";
			}
			continue;
		}
		current += char;
	}

	if (escaping) current += "\\";
	if (current) args.push(current);
	return args;
}
