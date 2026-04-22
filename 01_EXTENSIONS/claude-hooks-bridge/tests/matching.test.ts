import { describe, expect, it } from "vitest";
import { getClaudeToolName, getCommandHooks, matcherMatches } from "../src/matching.ts";
import type { ClaudeSettings } from "../src/types.ts";

describe("matching", () => {
	it("maps pi tool names to Claude names", () => {
		expect(getClaudeToolName("bash")).toBe("Bash");
		expect(getClaudeToolName("custom_tool")).toBe("custom_tool");
	});

	it("supports exact and regex-like matching", () => {
		expect(matcherMatches("Edit|Write", "edit")).toBe(true);
		expect(matcherMatches("mcp__memory__.*", "mcp__memory__create_entities")).toBe(true);
		expect(matcherMatches("Bash", "read")).toBe(false);
	});

	it("filters command hooks by matcher", () => {
		const settings: ClaudeSettings = {
			hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo ok" }] }] },
		};
		expect(getCommandHooks(settings, "PreToolUse", "bash")).toHaveLength(1);
		expect(getCommandHooks(settings, "PreToolUse", "read")).toHaveLength(0);
	});
});
