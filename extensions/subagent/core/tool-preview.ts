/**
 * Pure tool-call preview formatting — shared between core/store and ui/format.
 *
 * This module has no UI concerns (no theme, no colors). It produces plain
 * strings and structured parts that can be wrapped with a themed formatter
 * in ui/format.
 */

import * as os from "node:os";

export function formatPathValueForPreview(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  const home = os.homedir();
  return text.startsWith(home) ? `~${text.slice(home.length)}` : text;
}

export type ToolCallParts =
  | { kind: "bash"; command: string }
  | { kind: "read"; path: string; range: string }
  | { kind: "write"; path: string; lines: number }
  | { kind: "edit"; path: string }
  | { kind: "ls"; path: string }
  | { kind: "find"; pattern: string; path: string }
  | { kind: "grep"; pattern: string; path: string }
  | { kind: "default"; name: string; argsPreview: string };

/**
 * Parse a tool call into its structured rendering parts. The single source of
 * truth for how each known tool name maps to presentable fields. Both the
 * plain and themed renderers derive their output from this.
 */
export function formatToolCallParts(
  toolName: string,
  args: Record<string, unknown>,
): ToolCallParts {
  const shortenPath = (v: unknown) => formatPathValueForPreview(v);
  switch (toolName) {
    case "bash": {
      const c = typeof args.command === "string" && args.command ? args.command : "...";
      const command = c.length > 60 ? `${c.slice(0, 60)}...` : c;
      return { kind: "bash", command };
    }
    case "read": {
      const fp = shortenPath(args.file_path || args.path || "...");
      const o = typeof args.offset === "number" ? args.offset : undefined;
      const l = typeof args.limit === "number" ? args.limit : undefined;
      let range = "";
      if (o !== undefined || l !== undefined) {
        const s = o ?? 1;
        const e = l !== undefined ? s + l - 1 : "";
        range = `:${s}${e ? `-${e}` : ""}`;
      }
      return { kind: "read", path: fp, range };
    }
    case "write": {
      const fp = shortenPath(args.file_path || args.path || "...");
      const c = typeof args.content === "string" ? args.content : "";
      const lines = c.split("\n").length;
      return { kind: "write", path: fp, lines };
    }
    case "edit":
      return { kind: "edit", path: shortenPath(args.file_path || args.path || "...") };
    case "ls":
      return { kind: "ls", path: shortenPath(args.path || ".") };
    case "find": {
      const pattern = typeof args.pattern === "string" && args.pattern ? args.pattern : "*";
      return { kind: "find", pattern, path: shortenPath(args.path || ".") };
    }
    case "grep": {
      const pattern = typeof args.pattern === "string" ? args.pattern : "";
      return { kind: "grep", pattern, path: shortenPath(args.path || ".") };
    }
    default: {
      const s = JSON.stringify(args);
      const argsPreview = s.length > 50 ? `${s.slice(0, 50)}...` : s;
      return { kind: "default", name: toolName, argsPreview };
    }
  }
}

export function formatToolCallPlain(toolName: string, args: Record<string, unknown>): string {
  const parts = formatToolCallParts(toolName, args);
  switch (parts.kind) {
    case "bash":
      return `$ ${parts.command}`;
    case "read":
      return `read ${parts.path}${parts.range}`;
    case "write":
      return parts.lines > 1 ? `write ${parts.path} (${parts.lines} lines)` : `write ${parts.path}`;
    case "edit":
      return `edit ${parts.path}`;
    case "ls":
      return `ls ${parts.path}`;
    case "find":
      return `find ${parts.pattern} in ${parts.path}`;
    case "grep":
      return `grep /${parts.pattern}/ in ${parts.path}`;
    case "default":
      return `${parts.name} ${parts.argsPreview}`;
  }
}
