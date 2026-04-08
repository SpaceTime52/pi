import { existsSync, readdirSync, readFileSync } from "fs";
import { loadAgentsFromDir } from "./agents.js";
import { parseCommand, subcommandToToolCall } from "./cli.js";

function buildHelpText(agentsDir: string): string {
	const agents = existsSync(agentsDir) ? loadAgentsFromDir(agentsDir, (dir) => readdirSync(dir).map(String), readFileSync as (path: string, encoding: string) => string) : [];
	return [
		"subagent — 서브에이전트 오케스트레이션", "", "사용법:",
		"  /sub run <agent> [--main] -- <task>    에이전트 실행",
		"  /sub batch --agent <a> --task <t> ...  병렬 실행",
		"  /sub chain --agent <a> --task <t> ...  순차 실행",
		"  /sub continue <id> -- <task>           세션 이어하기",
		"  /sub abort <id>                        실행 중단",
		"  /sub detail <id>                       상세 히스토리",
		"  /sub runs                              실행 목록", "", "에이전트:",
		...agents.map((agent) => `  ${agent.name.padEnd(18)} ${agent.description}`),
	].join("\n");
}

interface SendFn { (content: string, opts?: { deliverAs?: "steer" | "followUp" }): void }
interface CommandCtx { ui: { notify(msg: string, type?: string): void } }

function buildInvocationMessage(args: string) {
	const call = subcommandToToolCall(parseCommand(args));
	return [`Call the ${call.toolName} tool immediately with these exact parameters.`, "Do not rewrite, summarize, or re-quote any task text.", JSON.stringify(call.input, null, 2)].join("\n\n");
}

export function buildSubCommand(agentsDir: string, sendUserMessage: SendFn) {
	return {
		description: "서브에이전트 명령 (run, batch, chain, continue, abort, detail, runs)",
		handler: async (args: string, ctx: CommandCtx) => {
			if (!args.trim()) return void ctx.ui.notify(buildHelpText(agentsDir), "info");
			try { sendUserMessage(buildInvocationMessage(args), { deliverAs: "steer" }); }
			catch (error) { ctx.ui.notify(error instanceof Error ? error.message : String(error), "error"); }
		},
	};
}
