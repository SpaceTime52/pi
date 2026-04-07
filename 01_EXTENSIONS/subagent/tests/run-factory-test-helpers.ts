import { vi } from "vitest";
import type { AgentConfig, RunResult } from "../src/types.js";
import { spawnAndCollect } from "../src/spawn.js";

export const agent: AgentConfig = { name: "scout", description: "", systemPrompt: "find", filePath: "/a.md" };
export const ok: RunResult = { id: 1, agent: "scout", output: "done", usage: { inputTokens: 10, outputTokens: 5, turns: 1 } };
export type EvtFn = (e: Record<string, unknown>) => void;
export const mockSpawn = () => spawnAndCollect as ReturnType<typeof vi.fn>;
export const makeCtx = () => ({ hasUI: false, ui: { setWidget: vi.fn() }, sessionManager: { getBranch: () => [] } });
export const latestText = (onUpdate: ReturnType<typeof vi.fn>) => onUpdate.mock.calls.at(-1)?.[0]?.content?.[0]?.text ?? "";
