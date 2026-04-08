import { Type } from "@sinclair/typebox";

const AgentTaskItem = Type.Object({
	agent: Type.String({ description: "Subagent name" }),
	task: Type.String({ description: "Full task text for that subagent" }),
}, { additionalProperties: false });

export const RunToolParams = Type.Object({
	agent: Type.String({ description: "Subagent name" }),
	task: Type.String({ description: "Full task text for the subagent" }),
	main: Type.Optional(Type.Boolean({ description: "Include summarized main-session context" })),
	cwd: Type.Optional(Type.String({ description: "Optional working directory override" })),
}, { additionalProperties: false });

export const BatchToolParams = Type.Object({
	items: Type.Array(AgentTaskItem, { description: "Parallel subagent tasks" }),
	main: Type.Optional(Type.Boolean({ description: "Include summarized main-session context" })),
}, { additionalProperties: false });

export const ChainToolParams = Type.Object({
	steps: Type.Array(AgentTaskItem, { description: "Sequential subagent steps" }),
	main: Type.Optional(Type.Boolean({ description: "Include summarized main-session context" })),
}, { additionalProperties: false });

export const ContinueToolParams = Type.Object({
	id: Type.Number({ description: "Run ID to continue" }),
	task: Type.String({ description: "Follow-up message for the existing run" }),
}, { additionalProperties: false });

const buildIdParams = (description: string) => Type.Object({
	id: Type.Number({ description }),
}, { additionalProperties: false });

export const AbortToolParams = buildIdParams("Run ID to abort");
export const DetailToolParams = buildIdParams("Run ID to inspect");
export const RunsToolParams = Type.Object({}, { additionalProperties: false });
