import type { Subcommand } from "./types.js";

interface ParsedArgs { _: string[]; [key: string]: unknown }

function parseArgs(input: string): ParsedArgs {
	const result: ParsedArgs = { _: [] };
	const tokens = input.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];
	for (let i = 0; i < tokens.length; i++) {
		const t = tokens[i];
		if (t.startsWith("--")) {
			const key = t.slice(2);
			const next = tokens[i + 1];
			if (!next || next.startsWith("--")) { result[key] = true; continue; }
			i++;
			const val = next.replace(/^"|"$/g, "");
			const prev = result[key];
			if (Array.isArray(prev)) { prev.push(val); }
			else if (prev !== undefined && prev !== true) { result[key] = [prev, val]; }
			else { result[key] = val; }
		} else { result._.push(t.replace(/^"|"$/g, "")); }
	}
	return result;
}

function toArray(val: unknown): string[] {
	if (Array.isArray(val)) return val.map(String);
	if (val !== undefined && val !== true) return [String(val)];
	return [];
}

function zipAgentTask(argv: ParsedArgs): Array<{ agent: string; task: string }> {
	const agents = toArray(argv.agent);
	const tasks = toArray(argv.task);
	return agents.map((a, i) => ({ agent: a, task: tasks[i] ?? "" }));
}

export function parseCommand(command: string): Subcommand {
	const [head, ...rest] = command.split(" -- ");
	const task = rest.join(" -- ").trim();
	const argv = parseArgs(head);
	const sub = String(argv._[0] ?? "");
	switch (sub) {
		case "run":
			return { type: "run", agent: String(argv._[1] ?? ""), task, main: Boolean(argv.main), cwd: argv.cwd ? String(argv.cwd) : undefined };
		case "batch":
			return { type: "batch", items: zipAgentTask(argv), main: Boolean(argv.main) };
		case "chain":
			return { type: "chain", steps: zipAgentTask(argv), main: Boolean(argv.main) };
		case "continue":
			return { type: "continue", id: Number(argv._[1]), task };
		case "abort":
			return { type: "abort", id: Number(argv._[1]) };
		case "detail":
			return { type: "detail", id: Number(argv._[1]) };
		case "runs":
			return { type: "runs" };
		default:
			throw new Error(`Unknown subcommand: ${sub}`);
	}
}
