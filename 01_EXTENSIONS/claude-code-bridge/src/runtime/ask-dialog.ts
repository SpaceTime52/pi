import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { Ctx } from "../core/types.js";
import { ClaudeAskDialog } from "./ask-dialog-component.js";

export { ClaudeAskDialog } from "./ask-dialog-component.js";

export const ASK_CONFIRM_TIMEOUT_MS = 10_000;

const DIALOG_MIN_WIDTH = 48;
const DIALOG_WIDTH = 72;

type AskDialogUi = Pick<ExtensionContext["ui"], "confirm"> &
	Partial<Pick<ExtensionContext["ui"], "custom">>;

export async function confirmClaudeAsk(
	ctx: Ctx,
	message: string,
	allowLabel: string,
): Promise<boolean> {
	if (!ctx.hasUI) return false;
	return confirmClaudeAskWithUi(ctx.ui, message, allowLabel);
}

export async function confirmClaudeAskWithUi(
	ui: AskDialogUi,
	message: string,
	allowLabel: string,
): Promise<boolean> {
	const fallbackMessage = `${message}\n\n${allowLabel}`;
	const result = await showCustomDialog(ui, message, allowLabel);
	if (typeof result === "boolean") return result;
	return ui.confirm("Claude hook confirmation", fallbackMessage, { timeout: ASK_CONFIRM_TIMEOUT_MS });
}

async function showCustomDialog(ui: AskDialogUi, message: string, allowLabel: string) {
	if (!ui.custom) return undefined;
	try {
		return await ui.custom<boolean | undefined>(
			(tui, theme, _keybindings, done) =>
				new ClaudeAskDialog(theme, message, allowLabel, ASK_CONFIRM_TIMEOUT_MS, done, () => tui.requestRender()),
			{ overlay: true, overlayOptions: { anchor: "center", width: DIALOG_WIDTH, minWidth: DIALOG_MIN_WIDTH, margin: 1 } },
		);
	} catch {
		return undefined;
	}
}
