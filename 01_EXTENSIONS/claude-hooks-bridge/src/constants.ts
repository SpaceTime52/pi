import os from "node:os";
import path from "node:path";

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
  glob: "Glob",
  ls: "LS",
};
