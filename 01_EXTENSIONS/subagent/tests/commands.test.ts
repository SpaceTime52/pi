import { describe, it, expect, vi } from "vitest";
import { buildSubCommand } from "../src/commands.js";

describe("buildSubCommand", () => {
	it("returns command with description", () => {
		const send = vi.fn();
		const cmd = buildSubCommand("/nonexistent", send);
		expect(cmd.description).toContain("서브에이전트");
	});

	it("handler shows help with no args", async () => {
		const send = vi.fn();
		const cmd = buildSubCommand(`${import.meta.dirname}/../agents`, send);
		const notify = vi.fn();
		await cmd.handler("", { ui: { notify } });
		expect(notify).toHaveBeenCalledOnce();
		expect(notify.mock.calls[0][0]).toContain("scout");
		expect(send).not.toHaveBeenCalled();
	});

	it("handler forwards args to sendUserMessage", async () => {
		const send = vi.fn();
		const cmd = buildSubCommand("/nonexistent", send);
		const notify = vi.fn();
		await cmd.handler("run scout -- hello", { ui: { notify } });
		expect(send).toHaveBeenCalledWith(expect.stringContaining("run scout -- hello"));
		expect(notify).not.toHaveBeenCalled();
	});

	it("handler shows help with missing agents dir", async () => {
		const send = vi.fn();
		const cmd = buildSubCommand("/nonexistent", send);
		const notify = vi.fn();
		await cmd.handler("", { ui: { notify } });
		expect(notify.mock.calls[0][0]).toContain("사용법:");
	});
});
