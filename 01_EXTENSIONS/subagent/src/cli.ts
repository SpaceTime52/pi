import { parseArgs, zipAgentTask } from "./cli-args.js";
import type { StructuredSubagentInput, SubagentToolInput, Subcommand } from "./types.js";

export function parseCommand(command: string): Subcommand {
	const [head, ...rest] = command.split(" -- ");
	const task = rest.join(" -- ").trim();
	const argv = parseArgs(head);
	switch (String(argv._[0] ?? "")) {
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
			throw new Error(`Unknown subcommand: ${String(argv._[0] ?? "")}`);
	}
}

export function normalizeInput(input: SubagentToolInput): Subcommand {
	if (!input || typeof input !== "object" || !("type" in input)) throw new Error("Invalid subagent input");
	const rawType = Reflect.get(input, "type");
	if (typeof rawType !== "string") throw new Error("Unknown subcommand: ");
	switch (input.type) {
		case "run": return { type: "run", agent: input.agent, task: input.task, main: Boolean(input.main), cwd: input.cwd };
		case "batch": return { type: "batch", items: input.items ?? [], main: Boolean(input.main) };
		case "chain": return { type: "chain", steps: input.steps ?? [], main: Boolean(input.main) };
		case "continue": return { type: "continue", id: input.id, task: input.task };
		case "abort": return { type: "abort", id: input.id };
		case "detail": return { type: "detail", id: input.id };
		case "runs": return { type: "runs" };
		default: throw new Error(`Unknown subcommand: ${rawType}`);
	}
}

export function subcommandToInput(cmd: Subcommand): StructuredSubagentInput {
	switch (cmd.type) {
		case "run": return { type: "run", agent: cmd.agent, task: cmd.task, ...(cmd.main ? { main: true } : {}), ...(cmd.cwd ? { cwd: cmd.cwd } : {}) };
		case "batch": return { type: "batch", items: cmd.items, ...(cmd.main ? { main: true } : {}) };
		case "chain": return { type: "chain", steps: cmd.steps, ...(cmd.main ? { main: true } : {}) };
		case "continue": return { type: "continue", id: cmd.id, task: cmd.task };
		case "abort": return { type: "abort", id: cmd.id };
		case "detail": return { type: "detail", id: cmd.id };
		case "runs": return { type: "runs" };
	}
}

const quoteArg = (value: string) => JSON.stringify(value);
export function stringifyCommand(cmd: Subcommand): string {
	switch (cmd.type) {
		case "run": return `run ${cmd.agent}${cmd.main ? " --main" : ""}${cmd.cwd ? ` --cwd ${quoteArg(cmd.cwd)}` : ""} -- ${cmd.task}`;
		case "batch": return `batch${cmd.main ? " --main" : ""}${cmd.items.map((item) => ` --agent ${quoteArg(item.agent)} --task ${quoteArg(item.task)}`).join("")}`;
		case "chain": return `chain${cmd.main ? " --main" : ""}${cmd.steps.map((step) => ` --agent ${quoteArg(step.agent)} --task ${quoteArg(step.task)}`).join("")}`;
		case "continue": return `continue ${cmd.id} -- ${cmd.task}`;
		case "abort": return `abort ${cmd.id}`;
		case "detail": return `detail ${cmd.id}`;
		case "runs": return "runs";
	}
}
