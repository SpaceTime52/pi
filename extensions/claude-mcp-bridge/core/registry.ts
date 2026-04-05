import type {
  AgentToolResult,
  ExtensionAPI,
  Theme,
  ToolRenderResultOptions,
} from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { executeMcpToolCall, renderMcpToolCall } from "./executor.js";
import type { McpManager } from "./manager.js";
import { createParameterSchema } from "./schema.js";
import { buildPiToolName } from "./tool-naming.js";

interface ToolRegistration {
  manager: McpManager;
  pi: ExtensionAPI;
  registeredTools: Set<string>;
  isToolDisabled: (serverName: string, toolName: string) => boolean;
}

function renderToolResult(
  result: AgentToolResult<unknown>,
  options: ToolRenderResultOptions,
  theme: Theme,
): Text {
  const tc = result.content.find((c) => c.type === "text");
  if (!options.expanded) {
    if (tc?.type === "text") {
      const count = tc.text.trim().split("\n").filter(Boolean).length;
      if (count > 0) return new Text(theme.fg("muted", ` -> ${count} lines`), 0, 0);
    }
    return new Text("", 0, 0);
  }
  if (!tc || tc.type !== "text") return new Text("", 0, 0);
  const output = tc.text
    .trim()
    .split("\n")
    .map((line) => theme.fg("toolOutput", line))
    .join("\n");
  return output ? new Text(`\n${output}`, 0, 0) : new Text("", 0, 0);
}

export function registerDiscoveredTools(ctx: ToolRegistration): void {
  const { manager, pi, registeredTools, isToolDisabled } = ctx;

  for (const { serverName, tool } of manager.getAllTools()) {
    if (isToolDisabled(serverName, tool.name)) continue;

    const piToolName = buildPiToolName(serverName, tool.name);
    if (registeredTools.has(piToolName)) continue;

    pi.registerTool({
      name: piToolName,
      label: `MCP ${serverName}/${tool.name}`,
      description: tool.description ?? `MCP tool ${serverName}/${tool.name}`,
      parameters: createParameterSchema(tool.inputSchema),
      renderCall: (args, theme) => renderMcpToolCall(serverName, tool.name, args, theme),
      renderResult: (result, options, theme) => renderToolResult(result, options, theme),
      execute: async (_toolCallId, params, signal, onUpdate) => {
        onUpdate?.({
          content: [{ type: "text", text: `Calling MCP ${serverName}/${tool.name}...` }],
          details: { server: serverName, tool: tool.name, status: "running" },
        });
        return executeMcpToolCall({
          manager,
          serverName,
          tool,
          params: params as Record<string, unknown>,
          ...(signal ? { signal } : {}),
          isToolDisabled,
        });
      },
    });

    registeredTools.add(piToolName);
  }
}
