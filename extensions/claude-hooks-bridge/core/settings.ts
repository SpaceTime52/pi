import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import {
  type ClaudeSettings,
  type LoadedSettings,
  SETTINGS_REL_PATH,
  type SettingsCacheEntry,
} from "./types.js";

const settingsCache = new Map<string, SettingsCacheEntry>();

export function getSettingsPath(cwd: string): string {
  return path.join(cwd, SETTINGS_REL_PATH);
}

export function loadSettings(cwd: string): LoadedSettings {
  const settingsPath = getSettingsPath(cwd);

  let mtimeMs = 0;
  try {
    mtimeMs = statSync(settingsPath).mtimeMs;
  } catch (e) {
    // ENOENT: the settings file is simply absent — silent no-op.
    // Anything else (EACCES, EPERM, ...) is a real failure worth surfacing.
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return { path: settingsPath, settings: null };
    }
    return {
      path: settingsPath,
      settings: null,
      parseError: `settings stat 실패: ${(e as Error).message}`,
    };
  }

  const cached = settingsCache.get(settingsPath);
  if (cached && cached.mtimeMs === mtimeMs) {
    return cached.loaded;
  }

  try {
    const raw = readFileSync(settingsPath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    const settings =
      parsed !== null && typeof parsed === "object" ? (parsed as ClaudeSettings) : null;
    const loaded: LoadedSettings = { path: settingsPath, settings };
    settingsCache.set(settingsPath, { mtimeMs, loaded });
    return loaded;
  } catch (error) {
    // readFileSync and JSON.parse always throw Error subclasses (NodeJS.ErrnoException / SyntaxError).
    const message = (error as Error).message;
    const loaded: LoadedSettings = {
      path: settingsPath,
      settings: null,
      parseError: `.claude/settings.json 파싱 실패: ${message}`,
    };
    settingsCache.set(settingsPath, { mtimeMs, loaded });
    return loaded;
  }
}

export function countHooks(settings: ClaudeSettings): number {
  if (!settings.hooks) return 0;
  let total = 0;
  for (const groups of Object.values(settings.hooks)) {
    if (!Array.isArray(groups)) continue;
    for (const group of groups) {
      if (!Array.isArray(group.hooks)) continue;
      total += group.hooks.filter(
        (hook) => hook?.type === "command" && typeof hook.command === "string",
      ).length;
    }
  }
  return total;
}
