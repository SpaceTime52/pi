/**
 * Pure tool-call preview formatting — shared between core/store and ui/format.
 *
 * This module has no UI concerns (no theme, no colors). It produces plain
 * strings that can be wrapped with a themed formatter in ui/format.
 */

import * as os from "node:os";

export function formatPathValueForPreview(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  const home = os.homedir();
  return text.startsWith(home) ? `~${text.slice(home.length)}` : text;
}

export function formatToolCallPlain(toolName: string, args: Record<string, unknown>): string {
  const shortenPath = (v: unknown) => formatPathValueForPreview(v);
  switch (toolName) {
    case "bash": {
      const c = (args.command as string) || "...";
      return `$ ${c.length > 60 ? `${c.slice(0, 60)}...` : c}`;
    }
    case "read": {
      const fp = shortenPath(args.file_path || args.path || "...");
      const o = args.offset as number | undefined;
      const l = args.limit as number | undefined;
      if (o !== undefined || l !== undefined) {
        const s = o ?? 1;
        const e = l !== undefined ? s + l - 1 : "";
        return `read ${fp}:${s}${e ? `-${e}` : ""}`;
      }
      return `read ${fp}`;
    }
    case "write": {
      const fp = shortenPath(args.file_path || args.path || "...");
      const c = (args.content || "") as string;
      const lines = c.split("\n").length;
      return lines > 1 ? `write ${fp} (${lines} lines)` : `write ${fp}`;
    }
    case "edit":
      return `edit ${shortenPath(args.file_path || args.path || "...")}`;
    case "ls":
      return `ls ${shortenPath(args.path || ".")}`;
    case "find": {
      const pattern = typeof args.pattern === "string" && args.pattern ? args.pattern : "*";
      return `find ${pattern} in ${shortenPath(args.path || ".")}`;
    }
    case "grep": {
      const pattern = typeof args.pattern === "string" ? args.pattern : "";
      return `grep /${pattern}/ in ${shortenPath(args.path || ".")}`;
    }
    default: {
      const s = JSON.stringify(args);
      return `${toolName} ${s.length > 50 ? `${s.slice(0, 50)}...` : s}`;
    }
  }
}
