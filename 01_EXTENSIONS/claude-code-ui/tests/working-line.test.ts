import type { AgentEndEvent, AgentStartEvent, ExtensionContext, SessionShutdownEvent } from "@mariozechner/pi-coding-agent";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { onAgentEnd, onAgentStart, onMessageUpdate, onSessionShutdown, onToolExecutionEnd, onToolExecutionStart } from "../src/working-line.ts";

const setWorkingMessage = vi.fn();
const ctx = { hasUI: true, ui: { setWorkingMessage } } as ExtensionContext;

describe("working-line handlers", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));
		setWorkingMessage.mockReset();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("renders Claude-style working lines through the turn lifecycle", () => {
		onToolExecutionStart({ toolName: "bash" });
		onToolExecutionEnd({});
		onMessageUpdate({ assistantMessageEvent: { type: "text_delta" } });
		expect(setWorkingMessage).not.toHaveBeenCalled();
		onAgentStart({} as AgentStartEvent, { hasUI: false } as ExtensionContext);
		expect(setWorkingMessage).not.toHaveBeenCalled();
		onAgentStart({} as AgentStartEvent, ctx);
		expect(setWorkingMessage.mock.lastCall?.[0]).toContain("... · 0s");
		vi.advanceTimersByTime(1000);
		expect(setWorkingMessage.mock.lastCall?.[0]).toContain("1s");
		onToolExecutionStart({ toolName: "bash" });
		expect(setWorkingMessage.mock.lastCall?.[0]).toContain("running bash");
		onMessageUpdate({ assistantMessageEvent: { type: "text_delta" } });
		onMessageUpdate({ assistantMessageEvent: { type: "thinking_start" } });
		expect(setWorkingMessage.mock.lastCall?.[0]).toContain("thinking");
		vi.advanceTimersByTime(1000);
		onMessageUpdate({ assistantMessageEvent: { type: "thinking_end" } });
		expect(setWorkingMessage.mock.lastCall?.[0]).toContain("thought for 1s");
		onToolExecutionStart({ toolName: "mcp" });
		expect(setWorkingMessage.mock.lastCall?.[0]).toContain("running mcp");
		onToolExecutionEnd({});
		expect(setWorkingMessage.mock.lastCall?.[0]).not.toContain("running mcp");
		onAgentEnd({} as AgentEndEvent, ctx);
		expect(setWorkingMessage.mock.lastCall).toEqual([]);
	});

	it("can clear on session shutdown without an active turn", () => {
		onSessionShutdown({} as SessionShutdownEvent, ctx);
		expect(setWorkingMessage.mock.lastCall).toEqual([]);
	});
});
