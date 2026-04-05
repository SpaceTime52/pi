import type { Theme } from "@mariozechner/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import type { ServerStatus } from "./types.js";

export function sColor(status: ServerStatus): "success" | "error" | "warning" | "muted" {
  switch (status) {
    case "connected":
      return "success";
    case "error":
      return "error";
    case "disconnected":
      return "warning";
    default:
      return "muted";
  }
}

export function sIcon(status: ServerStatus): string {
  switch (status) {
    case "connected":
      return "●";
    case "error":
      return "x";
    case "disconnected":
      return "○";
    default:
      return "◐";
  }
}

export function boxTop(th: Theme, title: string, innerW: number): string {
  const t = ` ${title} `;
  const tW = visibleWidth(t);
  const p1 = Math.floor((innerW - tW) / 2);
  const p2 = Math.max(0, innerW - tW - p1);
  return (
    th.fg("border", `╭${"─".repeat(p1)}`) +
    th.fg("accent", th.bold(t)) +
    th.fg("border", `${"─".repeat(p2)}╮`)
  );
}

export function boxSep(th: Theme, innerW: number): string {
  return th.fg("border", `├${"─".repeat(innerW)}┤`);
}

export function boxBot(th: Theme, innerW: number): string {
  return th.fg("border", `╰${"─".repeat(innerW)}╯`);
}

export function boxRow(th: Theme, content: string, innerW: number): string {
  return (
    th.fg("border", "│") + truncateToWidth(` ${content}`, innerW, "…", true) + th.fg("border", "│")
  );
}
