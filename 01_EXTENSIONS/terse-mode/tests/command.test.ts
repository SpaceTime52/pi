import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTerseCommand } from "../src/command.js";
import { ENTRY_TYPE } from "../src/constants.js";
import { isEnabled, resetState } from "../src/state.js";

function createCtx() {
	const notify = vi.fn<(message: string, type?: "info" | "warning" | "error") => void>();
	return { ctx: { ui: { notify } }, notify };
}

describe("createTerseCommand", () => {
	beforeEach(() => {
		resetState();
	});

	it("shows status by default and when disabled", async () => {
		const appendEntry = vi.fn();
		const { ctx, notify } = createCtx();
		const command = createTerseCommand(appendEntry);
		await command.handler("", ctx);
		expect(appendEntry).not.toHaveBeenCalled();
		expect(notify).toHaveBeenCalledWith("terse mode 현재 켜짐.", "info");

		await command.handler("off", ctx);
		await command.handler("status", ctx);
		expect(notify).toHaveBeenLastCalledWith("terse mode 현재 꺼짐.", "info");
	});

	it("enables, disables, and toggles mode while persisting state", async () => {
		const appendEntry = vi.fn();
		const { ctx, notify } = createCtx();
		const command = createTerseCommand(appendEntry);

		await command.handler("off", ctx);
		expect(isEnabled()).toBe(false);
		expect(notify).toHaveBeenLastCalledWith("terse mode 껐어.", "info");
		expect(appendEntry).toHaveBeenLastCalledWith(ENTRY_TYPE, expect.objectContaining({ enabled: false }));

		await command.handler("on", ctx);
		expect(isEnabled()).toBe(true);
		expect(notify).toHaveBeenLastCalledWith("terse mode 켰어.", "info");
		expect(appendEntry).toHaveBeenLastCalledWith(ENTRY_TYPE, expect.objectContaining({ enabled: true }));

		await command.handler("toggle", ctx);
		expect(isEnabled()).toBe(false);
		expect(notify).toHaveBeenLastCalledWith("terse mode 껐어.", "info");
	});

	it("reports already-enabled and already-disabled states", async () => {
		const appendEntry = vi.fn();
		const { ctx, notify } = createCtx();
		const command = createTerseCommand(appendEntry);

		await command.handler("on", ctx);
		expect(notify).toHaveBeenLastCalledWith("terse mode 이미 켜져 있어.", "info");

		await command.handler("off", ctx);
		await command.handler("off", ctx);
		expect(notify).toHaveBeenLastCalledWith("terse mode 이미 꺼져 있어.", "info");
	});

	it("rejects unknown arguments", async () => {
		const appendEntry = vi.fn();
		const { ctx, notify } = createCtx();
		await createTerseCommand(appendEntry).handler("weird", ctx);
		expect(notify).toHaveBeenCalledWith("사용법: /terse on|off|status|toggle", "warning");
	});
});
