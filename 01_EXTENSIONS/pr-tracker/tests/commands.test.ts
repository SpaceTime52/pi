import { describe, expect, it } from "vitest";
import { hasMergeMethod, parsePrCommand } from "../src/commands.ts";

describe("commands", () => {
	it("parses slash command arguments", () => {
		expect(parsePrCommand("")).toEqual({ command: "show", args: [] });
		expect(parsePrCommand("refresh")).toEqual({ command: "refresh", args: [] });
		expect(parsePrCommand("track 63")).toEqual({ command: "track", args: ["63"] });
		expect(parsePrCommand("https://github.com/acme/web/pull/63")).toEqual({
			command: "track",
			args: ["https://github.com/acme/web/pull/63"],
		});
	});

	it("detects merge method flags", () => {
		expect(hasMergeMethod(["--delete-branch"])).toBe(false);
		expect(hasMergeMethod(["--squash", "--delete-branch"])).toBe(true);
		expect(hasMergeMethod(["-m"])).toBe(true);
	});
});
