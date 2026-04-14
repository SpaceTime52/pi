import type { Theme } from "@mariozechner/pi-coding-agent";
import { matchesKey, truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@mariozechner/pi-tui";

const DIALOG_WIDTH = 72;
const TICK_MS = 250;

type AskDialogTheme = Pick<Theme, "fg" | "bg" | "bold">;

export class ClaudeAskDialog {
	private selected: "yes" | "no" = "yes";
	private readonly deadline: number;
	private lastRenderedSeconds: number;
	private readonly timer: ReturnType<typeof setInterval>;
	private closed = false;

	constructor(
		private readonly theme: AskDialogTheme,
		private readonly message: string,
		private readonly allowLabel: string,
		private readonly timeoutMs: number,
		private readonly done: (result: boolean) => void,
		private readonly requestRender: () => void,
	) {
		this.deadline = Date.now() + timeoutMs;
		this.lastRenderedSeconds = Math.ceil(timeoutMs / 1000);
		this.timer = setInterval(() => this.onTick(), TICK_MS);
	}

	handleInput(data: string): void {
		if (matchesKey(data, "escape")) return void this.finish(false);
		if (matchesKey(data, "left") || matchesKey(data, "up") || matchesKey(data, "shift+tab")) return void this.pick("yes");
		if (matchesKey(data, "right") || matchesKey(data, "down") || matchesKey(data, "tab")) return void this.pick("no");
		if (matchesKey(data, "return") || matchesKey(data, "enter")) return void this.finish(this.selected === "yes");
		if (data === "y" || data === "Y") return void this.finish(true);
		if (data === "n" || data === "N") return void this.finish(false);
	}

	render(width: number): string[] {
		const innerWidth = Math.max(22, Math.min(width, DIALOG_WIDTH)) - 2;
		const row = (content = "") => `${this.theme.fg("border", "│")}${pad(truncateToWidth(content, innerWidth, ""), innerWidth)}${this.theme.fg("border", "│")}`;
		const yes = this.button("Yes", this.selected === "yes");
		const no = this.button(`No (${this.seconds()}s)`, this.selected === "no");
		const header = this.theme.fg("accent", this.theme.bold("Claude hook confirmation"));
		const help = this.theme.fg("dim", "←/→ switch • Enter confirm • Esc/N no • Y yes");
		const lines = wrapTextWithAnsi(this.message, innerWidth - 2).filter(Boolean);
		return [
			this.theme.fg("border", `╭${"─".repeat(innerWidth)}╮`),
			row(center(header, innerWidth)),
			row(),
			...lines.map((line) => row(` ${line}`)),
			...(lines.length > 0 ? [row()] : []),
			row(` ${this.theme.fg("text", this.allowLabel)}`),
			row(),
			row(center(`${yes}  ${no}`, innerWidth)),
			row(),
			row(center(help, innerWidth)),
			this.theme.fg("border", `╰${"─".repeat(innerWidth)}╯`),
		];
	}

	invalidate(): void {}
	dispose(): void { this.closed = true; clearInterval(this.timer); }

	private onTick() {
		if (this.closed) return;
		const seconds = this.seconds();
		if (seconds <= 0) return void this.finish(false);
		if (seconds !== this.lastRenderedSeconds) this.lastRenderedSeconds = seconds, this.requestRender();
	}

	private pick(next: "yes" | "no") { if (this.selected !== next) this.selected = next, this.requestRender(); }
	private finish(result: boolean) { if (!this.closed) this.closed = true, clearInterval(this.timer), this.done(result); }
	private seconds() { return Math.max(0, Math.ceil((this.deadline - Date.now()) / 1000)); }
	private button(label: string, selected: boolean) {
		const text = ` ${label} `;
		return selected ? this.theme.bg("selectedBg", this.theme.fg("accent", this.theme.bold(text))) : this.theme.fg("muted", `[${text}]`);
	}
}

function pad(text: string, width: number) { return text + " ".repeat(Math.max(0, width - visibleWidth(text))); }
function center(text: string, width: number) { return `${" ".repeat(Math.max(0, Math.floor((width - visibleWidth(text)) / 2)))}${text}`; }
