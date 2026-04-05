import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { McpManager } from "./manager.js";
import { McpActionOverlay } from "./overlay-action.js";
import { McpStatusOverlay } from "./overlay-status.js";
import { McpToolListOverlay } from "./overlay-tools.js";
import { registerDiscoveredTools } from "./registry.js";
import { buildPiToolName } from "./tool-naming.js";
import {
  removeDisabledToolsFromActiveSet,
  setToolActive,
  type ToolVisibilityController,
} from "./tool-state.js";
import type { ReloadableContext, ServerAction } from "./types.js";
import { hasNewlyDisabledTools } from "./visibility.js";

interface FlowDeps {
  pi: ExtensionAPI;
  manager: McpManager;
  visibility: ToolVisibilityController;
  registeredTools: Set<string>;
  getOverlayWarnings: () => string[];
  updateStatus: (ctx: ExtensionContext) => void;
}

const OVERLAY_OPTS = {
  overlay: true as const,
  overlayOptions: {
    anchor: "center" as const,
    width: "80%" as const,
    minWidth: 50,
    maxHeight: "80%" as const,
  },
};

function handleToolToggle(
  deps: FlowDeps,
  ctx: ExtensionContext,
  serverName: string,
  toolName: string,
  setReloadNeeded: (value: boolean) => void,
): void {
  const { pi, manager, visibility, registeredTools } = deps;
  const toggled = visibility.toggle(serverName, toolName);
  if (!toggled.ok) {
    ctx.ui.notify(`Failed to save MCP tool settings: ${toggled.error}`, "warning");
    return;
  }

  registerDiscoveredTools({
    manager,
    pi,
    registeredTools,
    isToolDisabled: visibility.isToolDisabled,
  });
  removeDisabledToolsFromActiveSet(pi, manager, visibility);

  const piToolName = buildPiToolName(serverName, toolName);
  if (toggled.disabled) {
    if (registeredTools.has(piToolName)) setReloadNeeded(true);
    setToolActive(pi, piToolName, false);
    ctx.ui.notify(`${piToolName}: disabled`, "info");
    return;
  }

  if (registeredTools.has(piToolName)) {
    setToolActive(pi, piToolName, true);
    ctx.ui.notify(`${piToolName}: enabled`, "info");
    return;
  }
  ctx.ui.notify(`${piToolName}: enabled (connect or reload to register)`, "warning");
}

async function showToolOverlay(
  deps: FlowDeps,
  ctx: ExtensionContext,
  serverName: string,
  setReloadNeeded: (value: boolean) => void,
): Promise<void> {
  const tools = deps.manager.getServerTools(serverName);
  await ctx.ui.custom<null>(
    (tui, theme, _kb, done) =>
      new McpToolListOverlay(
        tui,
        theme,
        () => done(null),
        serverName,
        tools,
        (toolName) => deps.visibility.isToolDisabled(serverName, toolName),
        (toolName) => handleToolToggle(deps, ctx, serverName, toolName, setReloadNeeded),
      ),
    OVERLAY_OPTS,
  );
}

async function reconnectSelectedServer(
  deps: FlowDeps,
  ctx: ExtensionContext,
  serverName: string,
): Promise<void> {
  const { manager, pi, visibility, registeredTools, updateStatus } = deps;
  await manager.reconnectServer(serverName);
  registerDiscoveredTools({
    manager,
    pi,
    registeredTools,
    isToolDisabled: visibility.isToolDisabled,
  });
  removeDisabledToolsFromActiveSet(pi, manager, visibility);
  updateStatus(ctx);
  const updated = manager.getStates().find((s) => s.name === serverName);
  if (updated?.status === "connected") {
    ctx.ui.notify(`${serverName}: reconnected (${updated.toolCount} tools)`, "info");
    return;
  }
  const extra = updated?.error ? ` - ${updated.error}` : "";
  ctx.ui.notify(`${serverName}: ${updated?.status ?? "unknown"}${extra}`, "warning");
}

async function pickServerAction(
  ctx: ExtensionContext,
  deps: FlowDeps,
  serverName: string,
): Promise<ServerAction | null> {
  const serverState = deps.manager.getStates().find((s) => s.name === serverName);
  if (!serverState) return null;

  return ctx.ui.custom<ServerAction | null>(
    (tui, theme, _kb, done) => new McpActionOverlay(tui, theme, done, serverState),
    OVERLAY_OPTS,
  );
}

export async function openMcpStatusOverlay(
  deps: FlowDeps,
  ctx: ReloadableContext,
  disabledAtCommandStart: Set<string>,
): Promise<void> {
  let shouldReloadForVisibility = false;
  const setReloadNeeded = (value: boolean) => {
    if (value) shouldReloadForVisibility = true;
  };

  serverList: while (true) {
    const freshStates = deps.manager.getStates();
    const serverName = await ctx.ui.custom<string | null>(
      (tui, theme, _kb, done) =>
        new McpStatusOverlay(
          tui,
          theme,
          done,
          freshStates,
          deps.manager.sourcePath,
          deps.getOverlayWarnings(),
        ),
      OVERLAY_OPTS,
    );
    if (!serverName) break;

    while (true) {
      const action = await pickServerAction(ctx, deps, serverName);
      if (action === null) continue serverList;
      if (action === "tools") {
        await showToolOverlay(deps, ctx, serverName, setReloadNeeded);
        continue;
      }
      if (action === "reconnect") {
        await reconnectSelectedServer(deps, ctx, serverName);
        continue serverList;
      }
    }
  }

  const newlyDisabled = hasNewlyDisabledTools(disabledAtCommandStart, deps.visibility.snapshot());
  if (shouldReloadForVisibility || newlyDisabled) {
    ctx.ui.notify("Reloading runtime to hide disabled MCP tools...", "info");
    await ctx.reload();
  }
}

export function notifyStatusSummary(deps: FlowDeps, ctx: ExtensionContext): void {
  const states = deps.manager.getStates();
  const summary = states
    .map((s) => `${s.name}=${s.status}${s.toolCount > 0 ? `(${s.toolCount})` : ""}`)
    .join(", ");
  const sourceText = deps.manager.sourcePath ? ` | source: ${deps.manager.sourcePath}` : "";
  const disabledCount = deps.manager
    .getAllTools()
    .filter(({ serverName, tool }) => deps.visibility.isToolDisabled(serverName, tool.name)).length;
  const disabledText = disabledCount > 0 ? ` | disabled tools: ${disabledCount}` : "";
  ctx.ui.notify(`MCP: ${summary}${sourceText}${disabledText}`, "info");
}

export type { FlowDeps };
