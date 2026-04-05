import type { Theme } from "@mariozechner/pi-coding-agent";
import { matchesKey, type TUI } from "@mariozechner/pi-tui";
import { boxBot, boxRow, boxSep, boxTop, sColor, sIcon } from "./box.js";
import type { McpServerState, ServerAction } from "./types.js";

interface ActionEntry {
  id: ServerAction;
  label: string;
  hint: string;
}

export class McpActionOverlay {
  private actions: ActionEntry[] = [
    { id: "tools", label: "Tools", hint: "Enable/disable tools" },
    { id: "reconnect", label: "Reconnect", hint: "Disconnect & reconnect" },
  ];
  private sel = 0;

  constructor(
    private tui: TUI,
    private theme: Theme,
    private done: (value: ServerAction | null) => void,
    private state: McpServerState,
  ) {}

  handleInput(data: string): void {
    if (matchesKey(data, "escape")) {
      this.done(null);
      return;
    }
    if (matchesKey(data, "up") || data === "k") {
      this.sel = Math.max(0, this.sel - 1);
      this.tui.requestRender();
      return;
    }
    if (matchesKey(data, "down") || data === "j") {
      this.sel = Math.min(this.actions.length - 1, this.sel + 1);
      this.tui.requestRender();
      return;
    }
    if (matchesKey(data, "return")) {
      this.done(this.actions[this.sel]?.id ?? null);
    }
  }

  invalidate(): void {
    /* noop */
  }

  render(width: number): string[] {
    const th = this.theme;
    const iW = Math.max(1, width - 2);
    const st = this.state;
    const c = sColor(st.status);
    const ico = sIcon(st.status);
    const lines: string[] = [];

    lines.push(boxTop(th, st.name, iW));
    lines.push(boxRow(th, `${th.fg(c, `${ico} ${st.status}`)}  ${th.fg("muted", st.type)}`, iW));
    if (st.toolCount > 0) {
      lines.push(boxRow(th, th.fg("muted", `${st.toolCount} tools registered`), iW));
    }
    if (st.error) {
      lines.push(boxRow(th, th.fg("error", `! ${st.error}`), iW));
    }
    lines.push(boxSep(th, iW));

    for (let i = 0; i < this.actions.length; i++) {
      const a = this.actions[i];
      if (!a) continue;
      const sel = i === this.sel;
      const cursor = sel ? th.fg("accent", "▸") : " ";
      const label = sel ? th.fg("accent", th.bold(a.label)) : a.label;
      lines.push(boxRow(th, `${cursor} ${label}  ${th.fg("muted", a.hint)}`, iW));
    }

    lines.push(boxSep(th, iW));
    lines.push(boxRow(th, th.fg("muted", "up/down navigate · enter select · ESC back"), iW));
    lines.push(boxBot(th, iW));
    return lines;
  }
}
