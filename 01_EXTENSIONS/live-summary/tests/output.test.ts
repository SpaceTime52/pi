import { describe, expect, it } from "vitest";
import type { Badge } from "../src/badge.ts";
import { STATUS_COLOR_IDLE, STATUS_COLOR_WORKING } from "../src/badge.ts";
import { buildStatus, buildTitle, type OutputState } from "../src/output.ts";

const autoBadge: Badge = { emoji: "🦊", color: 39 };
const customBadge: Badge = { emoji: "🐢", color: 105 };

const base: OutputState = {
	cwdBasename: "pi",
	sessionName: undefined,
	cachedSummary: "",
	pinnedSummary: null,
	pinnedBadge: null,
	autoBadge,
	isWorking: false,
};

describe("buildTitle", () => {
	it("falls back to π · cwd when no summary or session name", () => {
		expect(buildTitle(base)).toBe("🦊 π · pi · pi");
	});

	it("uses session name when no summary", () => {
		expect(buildTitle({ ...base, sessionName: "feat" })).toBe("🦊 feat · pi");
	});

	it("uses pinned summary first, then cached", () => {
		expect(buildTitle({ ...base, cachedSummary: "🔧 작성" })).toBe("🦊 🔧 작성 · pi");
		expect(buildTitle({ ...base, cachedSummary: "x", pinnedSummary: "📌 핀" })).toBe("🦊 📌 핀 · pi");
	});

	it("renders pinned badge over auto when present", () => {
		expect(buildTitle({ ...base, pinnedBadge: customBadge, cachedSummary: "y" })).toBe("🐢 y · pi");
	});
});

describe("buildStatus", () => {
	it("uses dim gray dot when idle and no badges", () => {
		expect(buildStatus(base)).toBe(`\x1b[38;5;${STATUS_COLOR_IDLE}m●\x1b[39m …`);
	});

	it("uses green dot when working", () => {
		const out = buildStatus({ ...base, isWorking: true, cachedSummary: "🔧 a" });
		expect(out).toBe(`\x1b[38;5;${STATUS_COLOR_WORKING}m●\x1b[39m 🔧 a`);
	});

	it("uses 📌 prefix when summary is pinned (overrides badge)", () => {
		const out = buildStatus({ ...base, pinnedSummary: "🔧 핀", pinnedBadge: customBadge });
		expect(out).toBe("📌 🔧 핀");
	});

	it("uses pinned badge color/emoji when set and no summary pin", () => {
		const out = buildStatus({ ...base, pinnedBadge: customBadge, cachedSummary: "z" });
		expect(out).toBe(`\x1b[38;5;${customBadge.color}m${customBadge.emoji}\x1b[39m z`);
	});
});
