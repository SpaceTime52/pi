import { parseArgs, zipAgentTask } from "./cli-args.js";
import { subagentToolName } from "./tool-names.js";
import type {
	AbortToolInput,
	BatchToolInput,
	ChainToolInput,
	ContinueToolInput,
	DetailToolInput,
	RunToolInput,
	RunsToolInput,
	Subcommand,
} from "./types.js";

export function parseCommand(command: string): Subcommand {
	const [head, ...rest] = command.split(" -- ");
	const task = rest.join(" -- ").trim();
	const argv = parseArgs(head);
	switch (String(argv._[0] ?? "")) {
		case "run": return { type: "run", agent: String(argv._[1] ?? ""), task, main: Boolean(argv.main), cwd: argv.cwd ? String(argv.cwd) : undefined };
		case "batch": return { type: "batch", items: zipAgentTask(argv), main: Boolean(argv.main) };
		case "chain": return { type: "chain", steps: zipAgentTask(argv), main: Boolean(argv.main) };
		case "continue": return { type: "continue", id: Number(argv._[1]), task };
		case "abort": return { type: "abort", id: Number(argv._[1]) };
		case "detail": return { type: "detail", id: Number(argv._[1]) };
		case "runs": return { type: "runs" };
		default: throw new Error(`Unknown subcommand: ${String(argv._[0] ?? "")}`);
	}
}

export function subcommandToToolCall(cmd: Subcommand) {
	switch (cmd.type) {
		case "run": return { toolName: subagentToolName("run"), input: toRunInput(cmd) };
		case "batch": return { toolName: subagentToolName("batch"), input: toBatchInput(cmd) };
		case "chain": return { toolName: subagentToolName("chain"), input: toChainInput(cmd) };
		case "continue": return { toolName: subagentToolName("continue"), input: { id: cmd.id, task: cmd.task } satisfies ContinueToolInput };
		case "abort": return { toolName: subagentToolName("abort"), input: { id: cmd.id } satisfies AbortToolInput };
		case "detail": return { toolName: subagentToolName("detail"), input: { id: cmd.id } satisfies DetailToolInput };
		case "runs": return { toolName: subagentToolName("runs"), input: {} satisfies RunsToolInput };
	}
}

export function stringifyCommand(cmd: Subcommand): string {
	switch (cmd.type) {
		case "run": return `run ${cmd.agent}${cmd.main ? " --main" : ""}${cmd.cwd ? ` --cwd ${JSON.stringify(cmd.cwd)}` : ""} -- ${cmd.task}`;
		case "batch": return `batch${cmd.main ? " --main" : ""}${cmd.items.map((item) => ` --agent ${JSON.stringify(item.agent)} --task ${JSON.stringify(item.task)}`).join("")}`;
		case "chain": return `chain${cmd.main ? " --main" : ""}${cmd.steps.map((step) => ` --agent ${JSON.stringify(step.agent)} --task ${JSON.stringify(step.task)}`).join("")}`;
		case "continue": return `continue ${cmd.id} -- ${cmd.task}`;
		case "abort": return `abort ${cmd.id}`;
		case "detail": return `detail ${cmd.id}`;
		case "runs": return "runs";
	}
}

function toRunInput(cmd: Extract<Subcommand, { type: "run" }>): RunToolInput {
	return { agent: cmd.agent, task: cmd.task, ...(cmd.main ? { main: true } : {}), ...(cmd.cwd ? { cwd: cmd.cwd } : {}) };
}

function toBatchInput(cmd: Extract<Subcommand, { type: "batch" }>): BatchToolInput {
	return { items: cmd.items, ...(cmd.main ? { main: true } : {}) };
}

function toChainInput(cmd: Extract<Subcommand, { type: "chain" }>): ChainToolInput {
	return { steps: cmd.steps, ...(cmd.main ? { main: true } : {}) };
}
