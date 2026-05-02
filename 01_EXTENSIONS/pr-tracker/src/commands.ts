import { splitArgs } from "./parser.js";

export type PrSubcommand = "show" | "refresh" | "track" | "open" | "merge" | "untrack" | "help";

const SUBCOMMANDS = new Set<PrSubcommand>(["show", "refresh", "track", "open", "merge", "untrack", "help"]);
const MERGE_METHOD_FLAGS = new Set(["--merge", "-m", "--squash", "-s", "--rebase", "-r", "--auto", "--disable-auto"]);

export interface ParsedPrCommand {
	command: PrSubcommand;
	args: string[];
}

export function parsePrCommand(input: string): ParsedPrCommand {
	const args = splitArgs(input.trim());
	if (args.length === 0) return { command: "show", args: [] };
	const first = args[0]?.toLowerCase();
	if (first && SUBCOMMANDS.has(first as PrSubcommand)) {
		return { command: first as PrSubcommand, args: args.slice(1) };
	}
	return { command: "track", args };
}

export function hasMergeMethod(args: string[]): boolean {
	return args.some((arg) => MERGE_METHOD_FLAGS.has(arg));
}

export function mergeHelpText(): string {
	return "Use /pr merge --merge, /pr merge --squash, /pr merge --rebase, or /pr merge --auto. In interactive mode, /pr merge opens a method picker.";
}

export function helpText(): string {
	return [
		"PR tracker commands:",
		"/pr                 show tracked PR, or track current branch PR if none is tracked",
		"/pr refresh         refresh tracked PR status from GitHub",
		"/pr track <ref>     track PR number, URL, or branch (omitting ref uses current branch)",
		"/pr open            open tracked PR in the browser",
		"/pr merge [flags]   confirm and run gh pr merge for the tracked PR",
		"/pr untrack         remove PR tracking from this pi session",
	].join("\n");
}
