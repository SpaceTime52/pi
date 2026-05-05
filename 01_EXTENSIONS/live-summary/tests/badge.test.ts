import { describe, expect, it } from "vitest";
import {
	BADGE_COLORS_256,
	BADGE_EMOJIS,
	badgeFor,
	colorize256,
	hashStr,
	STATUS_COLOR_IDLE,
	STATUS_COLOR_WORKING,
} from "../src/badge.ts";

describe("badge helpers", () => {
	it("hashStr is deterministic and non-negative", () => {
		expect(hashStr("a")).toBe(hashStr("a"));
		expect(hashStr("")).toBeGreaterThanOrEqual(0);
		// distinct seeds usually produce distinct hashes
		expect(hashStr("alpha")).not.toBe(hashStr("beta"));
	});

	it("badgeFor returns palette entries indexed by hash", () => {
		const seed = "/Users/me/.pi/agent/sessions/abc.jsonl";
		const b = badgeFor(seed);
		const idx = hashStr(seed);
		expect(b.emoji).toBe(BADGE_EMOJIS[idx % BADGE_EMOJIS.length]);
		expect(b.color).toBe(BADGE_COLORS_256[idx % BADGE_COLORS_256.length]);
	});

	it("colorize256 wraps text in 256-color SGR sequences", () => {
		expect(colorize256("●", 46)).toBe("\x1b[38;5;46m●\x1b[39m");
		expect(colorize256("X", STATUS_COLOR_WORKING)).toContain("38;5;46m");
		expect(colorize256("X", STATUS_COLOR_IDLE)).toContain("38;5;244m");
	});
});
