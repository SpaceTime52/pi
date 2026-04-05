import type { Theme } from "@mariozechner/pi-coding-agent";
import { matchesKey, type TUI } from "@mariozechner/pi-tui";
import { boxBot, boxRow, boxSep, boxTop } from "./box.js";
import { buildPiToolName } from "./tool-naming.js";
import type { DiscoveredTool } from "./types.js";

const MAX_VISIBLE_TOOLS = 15;

export class McpToolListOverlay {
  private sel = 0;
  private scroll = 0;

  constructor(
    private tui: TUI,
    private theme: Theme,
    private onClose: () => void,
    private serverName: string,
    private tools: DiscoveredTool[],
    private isToolDisabled: (toolName: string) => boolean,
    private onToggleTool: (toolName: string) => void,
  ) {}

  private ensureSelectionVisible(): void {
    if (this.sel < this.scroll) {
      this.scroll = this.sel;
      return;
    }
    if (this.sel >= this.scroll + MAX_VISIBLE_TOOLS) {
      this.scroll = this.sel - MAX_VISIBLE_TOOLS + 1;
    }
  }

  handleInput(data: string): void {
    if (matchesKey(data, "escape")) {
      this.onClose();
      return;
    }

    if (this.tools.length === 0) return;

    if (matchesKey(data, "up") || data === "k") {
      this.sel = Math.max(0, this.sel - 1);
      this.ensureSelectionVisible();
      this.tui.requestRender();
      return;
    }

    if (matchesKey(data, "down") || data === "j") {
      this.sel = Math.min(this.tools.length - 1, this.sel + 1);
      this.ensureSelectionVisible();
      this.tui.requestRender();
      return;
    }

    if (matchesKey(data, "return") || data === " ") {
      const tool = this.tools[this.sel];
      if (!tool) return;
      this.onToggleTool(tool.name);
      this.tui.requestRender();
    }
  }

  invalidate(): void {
    /* noop */
  }

  private renderTools(th: Theme, iW: number, lines: string[]): void {
    const from = this.scroll;
    const to = Math.min(this.tools.length, this.scroll + MAX_VISIBLE_TOOLS);
    for (let i = from; i < to; i++) {
      const tool = this.tools[i];
      if (!tool) continue;
      const selected = i === this.sel;
      const cursor = selected ? th.fg("accent", "▸") : " ";
      const piName = buildPiToolName(this.serverName, tool.name);
      const name = selected ? th.fg("accent", th.bold(piName)) : piName;
      const enabled = !this.isToolDisabled(tool.name);
      const state = enabled ? th.fg("success", "on ") : th.fg("muted", "off");
      const desc = tool.description ? ` ${th.fg("muted", `— ${tool.description}`)}` : "";
      lines.push(boxRow(th, `${cursor} ${state} ${name}${desc}`, iW));
    }
    if (this.tools.length > MAX_VISIBLE_TOOLS) {
      lines.push(boxSep(th, iW));
      const info = `${from + 1}-${to} of ${this.tools.length}`;
      lines.push(boxRow(th, th.fg("muted", info), iW));
    }
  }

  render(width: number): string[] {
    const th = this.theme;
    const iW = Math.max(1, width - 2);
    const lines: string[] = [];
    const enabledCount = this.tools.filter((tool) => !this.isToolDisabled(tool.name)).length;

    lines.push(boxTop(th, `${this.serverName} · Tools`, iW));
    lines.push(boxRow(th, th.fg("muted", `Enabled ${enabledCount}/${this.tools.length}`), iW));
    lines.push(boxSep(th, iW));

    if (this.tools.length === 0) {
      lines.push(boxRow(th, th.fg("muted", "No tools available"), iW));
    } else {
      this.renderTools(th, iW, lines);
    }

    lines.push(boxSep(th, iW));
    lines.push(boxRow(th, th.fg("muted", "up/down navigate · Enter/Space toggle · ESC back"), iW));
    lines.push(boxBot(th, iW));
    return lines;
  }
}
