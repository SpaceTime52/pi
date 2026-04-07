import { describe, expect, it } from "vitest";
import { buildTerminalTitle } from "../src/handlers.js";

describe("buildTerminalTitle", () => {
	it("includes session name and cwd basename", () => {
		expect(buildTerminalTitle("/Users/me/Desktop/pi", "Fix footer")).toBe("π - Fix footer - pi");
	});

	it("falls back to the raw cwd when basename is empty", () => {
		expect(buildTerminalTitle("/", "Root session")).toBe("π - Root session - /");
	});
});
