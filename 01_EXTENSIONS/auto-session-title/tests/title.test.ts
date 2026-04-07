import { describe, it, expect } from "vitest";
import { DEFAULT_MAX_TITLE_LENGTH, deriveSessionTitle, truncateTitle } from "../src/title.js";

describe("deriveSessionTitle", () => {
	it("uses the first sentence of a normal user request", () => {
		expect(deriveSessionTitle("Fix the flaky auth test before release.")).toBe("Fix the flaky auth test before release");
	});

	it("returns undefined for empty input", () => {
		expect(deriveSessionTitle("   ")).toBeUndefined();
	});

	it("skips slash and bash-style commands", () => {
		expect(deriveSessionTitle("/name custom title")).toBeUndefined();
		expect(deriveSessionTitle("!git status")).toBeUndefined();
	});

	it("strips markdown prefixes and flattens whitespace", () => {
		expect(deriveSessionTitle("#   Investigate\n\n- the footer title issue")).toBe("Investigate");
	});

	it("falls back cleanly when markdown noise removes the whole body", () => {
		expect(deriveSessionTitle("```ts\nconst x = 1\n``` ")).toBeUndefined();
	});

	it("keeps very short quoted titles via the fallback branch", () => {
		expect(deriveSessionTitle("'ok'", 10)).toBe("ok");
	});

	it("returns undefined when punctuation stripping removes the whole title", () => {
		expect(deriveSessionTitle("''", 10)).toBeUndefined();
	});

	it("truncates long titles at a word boundary", () => {
		const input = "Implement automatic session titles from the first user message and wire them into terminal notifications";
		const title = deriveSessionTitle(input);
		expect(title).toBe("Implement automatic session titles from the…");
		expect(title!.length).toBeLessThanOrEqual(DEFAULT_MAX_TITLE_LENGTH);
	});
});

describe("truncateTitle", () => {
	it("returns short text unchanged", () => {
		expect(truncateTitle("short")).toBe("short");
	});

	it("falls back to a hard cutoff when no word break exists", () => {
		expect(truncateTitle("abcdefghijklmnopqrstuvwxyz", 10)).toBe("abcdefghij…");
	});
});
