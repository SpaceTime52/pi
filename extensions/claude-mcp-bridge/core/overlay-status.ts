import type { Theme } from "@mariozechner/pi-coding-agent";
import { matchesKey, type TUI } from "@mariozechner/pi-tui";
import { boxBot, boxRow, boxSep, boxTop, sColor, sIcon } from "./box.js";
import type { McpServerState } from "./types.js";

export class McpStatusOverlay {
  private sel = 0;

  constructor(
    private tui: TUI,
    private theme: Theme,
    private done: (value: string | null) => void,
    private states: McpServerState[],
    private sourcePath: string | null,
    private warnings: string[],
  ) {}

  handleInput(data: string): void {
    if (matchesKey(data, "escape") || data === "q") {
      this.done(null);
      return;
    }
    if (matchesKey(data, "up") || data === "k") {
      this.sel = Math.max(0, this.sel - 1);
      this.tui.requestRender();
      return;
    }
    if (matchesKey(data, "down") || data === "j") {
      this.sel = Math.min(this.states.length - 1, this.sel + 1);
      this.tui.requestRender();
      return;
    }
    if (matchesKey(data, "return")) {
      if (this.states.length > 0) this.done(this.states[this.sel]?.name ?? null);
    }
  }

  invalidate(): void {
    /* noop */
  }

  render(width: number): string[] {
    const th = this.theme;
    const iW = Math.max(1, width - 2);
    const lines: string[] = [];

    lines.push(boxTop(th, "MCP Server Status", iW));
    if (this.sourcePath) {
      lines.push(boxRow(th, th.fg("muted", `Source: ${this.sourcePath}`), iW));
    }
    lines.push(boxSep(th, iW));

    for (let i = 0; i < this.states.length; i++) {
      const st = this.states[i];
      if (!st) continue;
      const c = sColor(st.status);
      const ico = sIcon(st.status);
      const sel = i === this.sel;
      const cursor = sel ? th.fg("accent", "▸") : " ";
      const name = sel ? th.fg("accent", th.bold(st.name)) : st.name;
      const tools = st.toolCount > 0 ? th.fg("muted", ` ${st.toolCount} tools`) : "";
      const err = st.error ? `  ${th.fg("error", "!")}` : "";
      lines.push(
        boxRow(
          th,
          `${cursor} ${th.fg(c, ico)} ${name}  ${th.fg("muted", st.type)}${tools}${err}`,
          iW,
        ),
      );
    }

    if (this.warnings.length > 0) {
      lines.push(boxSep(th, iW));
      lines.push(boxRow(th, th.fg("warning", `! ${this.warnings.length} warning(s)`), iW));
    }

    lines.push(boxSep(th, iW));
    lines.push(boxRow(th, th.fg("muted", "up/down navigate · enter select · ESC close"), iW));
    lines.push(boxBot(th, iW));
    return lines;
  }
}
