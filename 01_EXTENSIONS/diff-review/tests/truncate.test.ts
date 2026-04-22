import { describe, expect, it } from "vitest";
import { truncateText } from "../src/truncate.ts";

describe("truncateText", () => {
	it("returns text unchanged when under limits", () => {
		expect(truncateText("a\nb", 10, 10)).toBe("a\nb");
	});

	it("truncates by characters before lines", () => {
		expect(truncateText("abcdef", 10, 3)).toContain("[truncated by characters]");
	});

	it("truncates by lines", () => {
		expect(truncateText("1\n2\n3", 2, 100)).toContain("[truncated by lines]");
	});
});
