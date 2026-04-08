import { Type } from "@sinclair/typebox";

const AgentTaskItem = Type.Object({
	agent: Type.String({ description: "Subagent name" }),
	task: Type.String({ description: "Full task text for that subagent" }),
}, { additionalProperties: false });

const RunParams = Type.Object({
	type: Type.Literal("run"),
	agent: Type.String({ description: "Subagent name" }),
	task: Type.String({ description: "Full task text for the subagent" }),
	main: Type.Optional(Type.Boolean({ description: "Include summarized main-session context" })),
	cwd: Type.Optional(Type.String({ description: "Optional working directory override" })),
}, { additionalProperties: false });

const BatchParams = Type.Object({
	type: Type.Literal("batch"),
	items: Type.Array(AgentTaskItem, { description: "Parallel subagent tasks" }),
	main: Type.Optional(Type.Boolean({ description: "Include summarized main-session context" })),
}, { additionalProperties: false });

const ChainParams = Type.Object({
	type: Type.Literal("chain"),
	steps: Type.Array(AgentTaskItem, { description: "Sequential subagent steps" }),
	main: Type.Optional(Type.Boolean({ description: "Include summarized main-session context" })),
}, { additionalProperties: false });

const ContinueParams = Type.Object({
	type: Type.Literal("continue"),
	id: Type.Number({ description: "Run ID to continue" }),
	task: Type.String({ description: "Follow-up message for the existing run" }),
}, { additionalProperties: false });

const IdOnlyParams = (type: "abort" | "detail", description: string) => Type.Object({
	type: Type.Literal(type),
	id: Type.Number({ description }),
}, { additionalProperties: false });

export const SubagentParams = Type.Union([
	RunParams,
	BatchParams,
	ChainParams,
	ContinueParams,
	IdOnlyParams("abort", "Run ID to abort"),
	IdOnlyParams("detail", "Run ID to inspect"),
	Type.Object({ type: Type.Literal("runs") }, { additionalProperties: false }),
]);
