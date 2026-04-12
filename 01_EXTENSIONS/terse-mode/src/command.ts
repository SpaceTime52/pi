import type { ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import { ENTRY_TYPE } from "./constants.js";
import { buildEntry, isEnabled, setEnabled } from "./state.js";

interface CommandDef {
	description: string;
	handler: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
}

type NotifyLevel = "info" | "warning" | "error";
type NotifyFn = (message: string, type?: NotifyLevel) => void;
type AppendEntryFn = (customType: string, data?: TerseModeCommandEntry) => void;

interface TerseModeCommandEntry {
	enabled: boolean;
	updatedAt: number;
}

export function createTerseCommand(appendEntry: AppendEntryFn): CommandDef {
	return {
		description: "짧은 응답 스타일 제어. 사용법: /terse on|off|status|toggle",
		handler: async (args: string, ctx: ExtensionCommandContext) => {
			const action = normalizeAction(args);
			if (action === "status") return notifyStatus(ctx.ui.notify.bind(ctx.ui));
			if (action === "on") return applyState(true, appendEntry, ctx.ui.notify.bind(ctx.ui));
			if (action === "off") return applyState(false, appendEntry, ctx.ui.notify.bind(ctx.ui));
			if (action === "toggle") return applyState(!isEnabled(), appendEntry, ctx.ui.notify.bind(ctx.ui));
			ctx.ui.notify("사용법: /terse on|off|status|toggle", "warning");
		},
	};
}

function normalizeAction(raw: string): string {
	const trimmed = raw.trim().toLowerCase();
	return trimmed || "status";
}

function applyState(next: boolean, appendEntry: AppendEntryFn, notify: NotifyFn): void {
	const changed = setEnabled(next);
	appendEntry(ENTRY_TYPE, buildEntry());
	if (!changed) return notify(next ? "terse mode 이미 켜져 있어." : "terse mode 이미 꺼져 있어.", "info");
	notify(next ? "terse mode 켰어." : "terse mode 껐어.", "info");
}

function notifyStatus(notify: NotifyFn): void {
	notify(isEnabled() ? "terse mode 현재 켜짐." : "terse mode 현재 꺼짐.", "info");
}
