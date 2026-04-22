import { describe, expect, it } from "vitest";
import { convertHookTimeoutToMs } from "../src/process.ts";
import { extractDecision, normalizeToolInput, parseJsonFromStdout, toBlockReason } from "../src/text.ts";

describe("text helpers", () => {
	it("converts timeout seconds to ms", () => {
		expect(convertHookTimeoutToMs(30)).toBe(30000);
	});

	it("parses JSON output and decisions", () => {
		expect(parseJsonFromStdout('log\n{"ok":true}\n')).toEqual({ ok: true });
		expect(
			extractDecision({ command: "echo", code: 2, stdout: "", stderr: "Denied", timedOut: false, json: null }),
		).toEqual({ action: "block", reason: "Denied" });
	});

	it("normalizes paths and block reasons", () => {
		expect(normalizeToolInput("read", { path: "src/index.ts" }, "/tmp/demo").path).toBe("/tmp/demo/src/index.ts");
		expect(toBlockReason(undefined, "fallback")).toBe("fallback");
	});
});
