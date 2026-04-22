import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { SETTINGS_REL_PATH } from "./constants.js";
import type { ClaudeSettings, LoadedSettings } from "./types.js";

interface SettingsCacheEntry { mtimeMs: number; loaded: LoadedSettings; }
const settingsCache = new Map<string, SettingsCacheEntry>();

export function getSettingsPath(cwd: string): string {
  return path.join(cwd, SETTINGS_REL_PATH);
}
export function loadSettings(cwd: string): LoadedSettings {
  const settingsPath = getSettingsPath(cwd);
  if (!existsSync(settingsPath)) return { path: settingsPath, settings: null };
  let mtimeMs = 0;
  try { mtimeMs = statSync(settingsPath).mtimeMs; }
  catch { return { path: settingsPath, settings: null, parseError: "settings 파일 상태를 읽을 수 없습니다." }; }
  const cached = settingsCache.get(settingsPath);
  if (cached && cached.mtimeMs === mtimeMs) return cached.loaded;
  try {
    const parsed = JSON.parse(readFileSync(settingsPath, "utf8"));
    const settings = typeof parsed === "object" && parsed ? (parsed as ClaudeSettings) : null;
    const loaded = { path: settingsPath, settings };
    settingsCache.set(settingsPath, { mtimeMs, loaded });
    return loaded;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const loaded = { path: settingsPath, settings: null, parseError: `.claude/settings.json 파싱 실패: ${message}` };
    settingsCache.set(settingsPath, { mtimeMs, loaded });
    return loaded;
  }
}
