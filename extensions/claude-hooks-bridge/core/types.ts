import os from "node:os";
import path from "node:path";

export type ClaudeHookEventName =
  | "SessionStart"
  | "UserPromptSubmit"
  | "PreToolUse"
  | "PostToolUse"
  | "Stop";

export type JsonRecord = Record<string, unknown>;

export interface ClaudeCommandHook {
  type?: string;
  command?: string;
  timeout?: number;
}

export interface ClaudeHookGroup {
  matcher?: string;
  hooks?: ClaudeCommandHook[];
}

export interface ClaudeSettings {
  hooks?: Record<string, ClaudeHookGroup[]>;
}

export interface LoadedSettings {
  path: string;
  settings: ClaudeSettings | null;
  parseError?: string;
}

export interface SettingsCacheEntry {
  mtimeMs: number;
  loaded: LoadedSettings;
}

export interface HookExecResult {
  command: string;
  code: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  json: unknown | null;
}

export interface HookDecision {
  action: "none" | "allow" | "ask" | "block";
  reason?: string;
}

export const SETTINGS_REL_PATH = path.join(".claude", "settings.json");
export const TRANSCRIPT_TMP_DIR = path.join(os.tmpdir(), "pi-claude-hooks-bridge");
export const DEFAULT_HOOK_TIMEOUT_MS = 600_000;

export const BUILTIN_TOOL_ALIASES: Record<string, string> = {
  bash: "Bash",
  read: "Read",
  edit: "Edit",
  write: "Write",
  grep: "Grep",
  find: "Find",
  ls: "LS",
};
