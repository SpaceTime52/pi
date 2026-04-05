import fs from "node:fs";
import path from "node:path";
import { TOOL_VISIBILITY_KEY_SEPARATOR, TOOL_VISIBILITY_SETTINGS_PATH } from "./constants.js";

export interface ToolVisibilitySettingsFile {
  disabledTools?: Record<string, string[]> | string[];
}

export interface LoadedToolVisibilitySettings {
  disabledToolKeys: Set<string>;
  warning?: string;
}

export function buildToolVisibilityKey(serverName: string, toolName: string): string {
  return `${serverName}${TOOL_VISIBILITY_KEY_SEPARATOR}${toolName}`;
}

export function parseToolVisibilityKey(
  key: string,
): { serverName: string; toolName: string } | null {
  const separatorIndex = key.indexOf(TOOL_VISIBILITY_KEY_SEPARATOR);
  if (separatorIndex <= 0 || separatorIndex >= key.length - 1) return null;

  const serverName = key.slice(0, separatorIndex).trim();
  const toolName = key.slice(separatorIndex + TOOL_VISIBILITY_KEY_SEPARATOR.length).trim();
  if (!serverName || !toolName) return null;

  return { serverName, toolName };
}

function addDisabledToolKey(result: Set<string>, serverNameRaw: string, toolNameRaw: string): void {
  const serverName = serverNameRaw.trim();
  const toolName = toolNameRaw.trim();
  if (!serverName || !toolName) return;
  result.add(buildToolVisibilityKey(serverName, toolName));
}

function parseDisabledToolList(value: string[]): Set<string> {
  const result = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const separatorIndex = item.indexOf("/");
    if (separatorIndex <= 0 || separatorIndex >= item.length - 1) continue;
    addDisabledToolKey(result, item.slice(0, separatorIndex), item.slice(separatorIndex + 1));
  }
  return result;
}

function parseDisabledToolMap(value: Record<string, unknown>): Set<string> {
  const result = new Set<string>();
  for (const [serverNameRaw, tools] of Object.entries(value)) {
    if (!Array.isArray(tools)) continue;
    for (const toolNameRaw of tools) {
      if (typeof toolNameRaw !== "string") continue;
      addDisabledToolKey(result, serverNameRaw, toolNameRaw);
    }
  }
  return result;
}

function parseDisabledToolKeys(value: unknown): Set<string> {
  if (!value) return new Set<string>();
  if (Array.isArray(value)) return parseDisabledToolList(value);
  if (typeof value !== "object") return new Set<string>();
  return parseDisabledToolMap(value as Record<string, unknown>);
}

export function loadToolVisibilitySettings(
  settingsPath: string = TOOL_VISIBILITY_SETTINGS_PATH,
): LoadedToolVisibilitySettings {
  if (!fs.existsSync(settingsPath)) {
    return { disabledToolKeys: new Set<string>() };
  }

  try {
    const raw = fs.readFileSync(settingsPath, "utf-8");
    const parsed = JSON.parse(raw) as ToolVisibilitySettingsFile;
    if (!parsed || typeof parsed !== "object") {
      return {
        disabledToolKeys: new Set<string>(),
        warning: `Invalid tool visibility settings format: ${settingsPath}`,
      };
    }
    return { disabledToolKeys: parseDisabledToolKeys(parsed.disabledTools) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      disabledToolKeys: new Set<string>(),
      warning: `Failed to load tool visibility settings (${settingsPath}): ${message}`,
    };
  }
}

function serializeToolVisibilitySettings(
  disabledToolKeys: Set<string>,
): ToolVisibilitySettingsFile {
  const grouped = new Map<string, string[]>();

  for (const key of disabledToolKeys) {
    const parsed = parseToolVisibilityKey(key);
    if (!parsed) continue;

    const tools = grouped.get(parsed.serverName) ?? [];
    tools.push(parsed.toolName);
    grouped.set(parsed.serverName, tools);
  }

  const disabledTools: Record<string, string[]> = {};
  const sortedServers = Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b));
  for (const serverName of sortedServers) {
    const tools = grouped.get(serverName) ?? [];
    const dedupedTools = Array.from(new Set(tools)).sort((a, b) => a.localeCompare(b));
    if (dedupedTools.length > 0) {
      disabledTools[serverName] = dedupedTools;
    }
  }

  return { disabledTools };
}

export function saveToolVisibilitySettings(
  disabledToolKeys: Set<string>,
  settingsPath: string = TOOL_VISIBILITY_SETTINGS_PATH,
): { ok: true } | { ok: false; error: string } {
  try {
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    const payload = serializeToolVisibilitySettings(disabledToolKeys);
    fs.writeFileSync(settingsPath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
}

export function hasNewlyDisabledTools(before: Set<string>, after: Set<string>): boolean {
  for (const key of after) {
    if (!before.has(key)) return true;
  }
  return false;
}
