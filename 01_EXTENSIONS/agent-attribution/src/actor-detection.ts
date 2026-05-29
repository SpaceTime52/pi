type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | undefined {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
	return value as JsonRecord;
}

export function unique(values: string[]): string[] {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const value of values) {
		const normalized = value.trim();
		if (!normalized || seen.has(normalized)) continue;
		seen.add(normalized);
		result.push(normalized);
	}
	return result;
}

function unquoteToken(token: string | undefined): string | undefined {
	const trimmed = token?.trim().replace(/^["']|["']$/g, "").trim();
	return trimmed === "" ? undefined : trimmed;
}

function readStringField(record: JsonRecord | undefined, keys: string[]): string | undefined {
	if (!record) return undefined;
	for (const key of keys) {
		const value = record[key];
		if (typeof value === "string" && value.trim()) return value.trim();
	}
	return undefined;
}

function readStringArrayField(record: JsonRecord | undefined, keys: string[]): string[] {
	if (!record) return [];
	for (const key of keys) {
		const value = record[key];
		if (!Array.isArray(value)) continue;
		return value
			.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
			.map((item) => item.trim());
	}
	return [];
}

export function inferActorsFromSubagentCommand(command: string): string[] {
	const actors: string[] = [];

	const flagPattern = /(?:^|\s)--agent(?:=|\s+)(?:"([^"]*)"|'([^']*)'|([^\s]+))/g;
	for (const match of command.matchAll(flagPattern)) {
		const actor = unquoteToken(match[1] ?? match[2] ?? match[3]);
		if (actor) actors.push(actor);
	}

	const runPattern = /(?:^|\s)subagent\s+(?:run|continue)\s+(?:--[^\s]+\s+)*([^\s]+)/;
	const runMatch = command.match(runPattern);
	const firstRunToken = unquoteToken(runMatch?.[1]);
	if (firstRunToken && !firstRunToken.startsWith("-") && !/^\d+$/.test(firstRunToken)) {
		actors.push(firstRunToken);
	}

	if (actors.length === 0 && /(?:^|\s)subagent\s+run(?:\s|$)/.test(command)) {
		actors.push("worker");
	}

	return unique(actors);
}

export function inferActorsFromTool(toolName: string, args: unknown): string[] {
	const lowerName = toolName.toLowerCase();
	const record = asRecord(args);

	if (lowerName === "subagent") {
		const command = readStringField(record, ["command"]);
		if (command) return inferActorsFromSubagentCommand(command);
		return unique([
			...readStringArrayField(record, ["agents", "agentTypes", "agent_types"]),
			readStringField(record, ["agent", "subagent_type", "subagentType"]) ?? "",
		]);
	}

	if (lowerName === "agent") {
		return unique([readStringField(record, ["subagent_type", "subagentType", "agent", "agentType"]) ?? ""]);
	}

	if (lowerName === "taskexecute" || lowerName === "task_execute") {
		return ["task agents"];
	}

	return [];
}
