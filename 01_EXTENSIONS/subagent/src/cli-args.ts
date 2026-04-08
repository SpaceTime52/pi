interface ParsedArgs { _: string[]; [key: string]: unknown }
type Quote = "single" | "double";

function tokenize(input: string): string[] {
	const tokens: string[] = [];
	let current = "";
	let quote: Quote | undefined;
	let escaping = false;
	let tokenStarted = false;
	const push = () => { if (tokenStarted) tokens.push(current); current = ""; tokenStarted = false; };
	for (const ch of input) {
		if (escaping) { current += ch; escaping = false; tokenStarted = true; continue; }
		if (quote) {
			if ((quote === "single" && ch === "'") || (quote === "double" && ch === '"')) { quote = undefined; continue; }
			if (ch === "\\") { escaping = true; continue; }
			current += ch; tokenStarted = true; continue;
		}
		if (/\s/.test(ch)) { push(); continue; }
		if (ch === "'" || ch === '"') { quote = ch === "'" ? "single" : "double"; tokenStarted = true; continue; }
		if (ch === "\\") { escaping = true; tokenStarted = true; continue; }
		current += ch; tokenStarted = true;
	}
	if (escaping) throw new Error("Unterminated escape sequence");
	if (quote) throw new Error(`Unterminated ${quote} quote`);
	push();
	return tokens;
}

function toArray(value: unknown): string[] {
	if (Array.isArray(value)) return value.map(String);
	if (value !== undefined && value !== true) return [String(value)];
	return [];
}

export function parseArgs(input: string): ParsedArgs {
	const parsed: ParsedArgs = { _: [] };
	const tokens = tokenize(input);
	for (const [index, token] of tokens.entries()) {
		if (!token.startsWith("--")) { parsed._.push(token); continue; }
		const key = token.slice(2);
		const next = tokens[index + 1];
		if (!next || next.startsWith("--")) parsed[key] = true;
	}
	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i];
		if (!token.startsWith("--")) continue;
		const key = token.slice(2);
		const next = tokens[i + 1];
		if (!next || next.startsWith("--")) continue;
		i++;
		const prev = parsed[key];
		if (Array.isArray(prev)) prev.push(next);
		else if (prev !== undefined && prev !== true) parsed[key] = [prev, next];
		else parsed[key] = next;
	}
	return parsed;
}

export function zipAgentTask(argv: ParsedArgs): Array<{ agent: string; task: string }> {
	const agents = toArray(argv.agent);
	const tasks = toArray(argv.task);
	return agents.map((agent, index) => ({ agent, task: tasks[index] ?? "" }));
}
