import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { McpManager } from "./manager.js";
import { buildPiToolName } from "./tool-naming.js";
import { buildToolVisibilityKey, saveToolVisibilitySettings } from "./visibility.js";

export interface ToolVisibilityController {
  isToolDisabled(serverName: string, toolName: string): boolean;
  toggle(
    serverName: string,
    toolName: string,
  ): { ok: true; disabled: boolean } | { ok: false; error: string };
  clearWarning(): void;
  getWarning(): string | undefined;
  snapshot(): Set<string>;
  hasNewlyDisabled(before: Set<string>): boolean;
}

export function createVisibilityController(
  disabledToolKeys: Set<string>,
  initialWarning: string | undefined,
): ToolVisibilityController {
  let warning = initialWarning;
  return {
    isToolDisabled: (serverName, toolName) =>
      disabledToolKeys.has(buildToolVisibilityKey(serverName, toolName)),
    toggle(serverName, toolName) {
      const key = buildToolVisibilityKey(serverName, toolName);
      const currentlyDisabled = disabledToolKeys.has(key);
      const nextDisabled = !currentlyDisabled;

      if (nextDisabled) disabledToolKeys.add(key);
      else disabledToolKeys.delete(key);

      const saved = saveToolVisibilitySettings(disabledToolKeys);
      if (!saved.ok) {
        if (currentlyDisabled) disabledToolKeys.add(key);
        else disabledToolKeys.delete(key);
        return { ok: false, error: saved.error };
      }

      warning = undefined;
      return { ok: true, disabled: nextDisabled };
    },
    clearWarning: () => {
      warning = undefined;
    },
    getWarning: () => warning,
    snapshot: () => new Set(disabledToolKeys),
    hasNewlyDisabled(before) {
      for (const key of disabledToolKeys) {
        if (!before.has(key)) return true;
      }
      return false;
    },
  };
}

export function removeDisabledToolsFromActiveSet(
  pi: ExtensionAPI,
  manager: McpManager,
  visibility: ToolVisibilityController,
): void {
  let activeTools: Set<string>;
  try {
    activeTools = new Set(pi.getActiveTools());
  } catch {
    return;
  }

  let changed = false;

  for (const { serverName, tool } of manager.getAllTools()) {
    if (!visibility.isToolDisabled(serverName, tool.name)) continue;
    const piToolName = buildPiToolName(serverName, tool.name);
    if (activeTools.delete(piToolName)) changed = true;
  }

  if (changed) {
    pi.setActiveTools(Array.from(activeTools));
  }
}

export function setToolActive(pi: ExtensionAPI, piToolName: string, enabled: boolean): void {
  let activeTools: Set<string>;
  try {
    activeTools = new Set(pi.getActiveTools());
  } catch {
    return;
  }

  let changed = false;
  if (enabled) {
    if (!activeTools.has(piToolName)) {
      activeTools.add(piToolName);
      changed = true;
    }
  } else if (activeTools.delete(piToolName)) {
    changed = true;
  }

  if (changed) {
    pi.setActiveTools(Array.from(activeTools));
  }
}
