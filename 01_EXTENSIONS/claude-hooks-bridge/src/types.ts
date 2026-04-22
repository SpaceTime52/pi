export type ClaudeHookEventName = "SessionStart" | "UserPromptSubmit" | "PreToolUse" | "PostToolUse" | "Stop";
export type JsonRecord = Record<string, unknown>;

export interface ClaudeCommandHook { type?: string; command?: string; timeout?: number; }
export interface ClaudeHookGroup { matcher?: string; hooks?: ClaudeCommandHook[]; }
export interface ClaudeSettings { hooks?: Record<string, ClaudeHookGroup[]>; }
export interface LoadedSettings { path: string; settings: ClaudeSettings | null; parseError?: string; }
export interface HookExecResult {
  command: string; code: number; stdout: string; stderr: string; timedOut: boolean; json: unknown | null;
}
export interface HookDecision { action: "none" | "allow" | "ask" | "block"; reason?: string; }

export interface UiLike {
  notify(message: string, level: "info" | "warning" | "error"): void;
  confirm(title: string, message: string): Promise<boolean>;
}
export interface SessionEntryLike {
  type?: string;
  message: { role: string; content: unknown; toolCallId?: string };
}
export interface SessionManagerLike {
  getSessionId(): string;
  getEntries(): SessionEntryLike[];
}
export interface RuntimeContextLike {
  cwd: string;
  hasUI: boolean;
  ui: UiLike;
  sessionManager: SessionManagerLike;
}
export interface ToolCallEventLike { toolName: string; input: unknown; toolCallId: string; }
export interface ToolResultEventLike {
  toolName: string; input: unknown; toolCallId: string; isError?: boolean; content: unknown; details: unknown;
}
export interface PiApiLike {
  on(eventName: string, handler: (event: any, ctx: RuntimeContextLike) => unknown): void;
  sendUserMessage(content: string, options?: { deliverAs?: "steer" | "followUp" | "nextTurn" }): void;
}
