import { describe, expect, it } from "vitest";
import { isSubagentToolName, subagentToolKinds, subagentToolName, subcommandTypeFromToolName } from "../src/tool-names.js";

describe("subagent tool names", () => {
	it("builds and recognizes tool names", () => {
		expect(subagentToolKinds).toContain("batch");
		expect(subagentToolName("run")).toBe("subagent_run");
		expect(isSubagentToolName("subagent_run")).toBe(true);
		expect(isSubagentToolName("subagent")).toBe(true);
		expect(isSubagentToolName("other_tool")).toBe(false);
	});

	it("maps tool names back to subcommand types", () => {
		expect(subcommandTypeFromToolName("subagent_chain")).toBe("chain");
		expect(subcommandTypeFromToolName("subagent_unknown")).toBeUndefined();
	});
});
