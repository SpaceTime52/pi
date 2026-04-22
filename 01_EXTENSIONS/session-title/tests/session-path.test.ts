import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { SUBAGENT_SESSION_DIR, extractSessionFilePath, isSubagentSessionPath } from "../src/session-path.ts";

describe("session path helpers", () => {
	it("detects subagent session files", () => {
		expect(isSubagentSessionPath(undefined)).toBe(false);
		expect(isSubagentSessionPath(`${SUBAGENT_SESSION_DIR}${path.sep}child${path.sep}a.jsonl`)).toBe(true);
		expect(isSubagentSessionPath(`${SUBAGENT_SESSION_DIR}/child/a.jsonl`)).toBe(true);
		expect(isSubagentSessionPath("/tmp/normal.jsonl")).toBe(false);
	});

	it("extracts and sanitizes session file paths", () => {
		expect(extractSessionFilePath({ getSessionFile: () => "\n/tmp/test.jsonl\t" })).toBe("/tmp/test.jsonl");
		expect(extractSessionFilePath({ getSessionFile: () => undefined })).toBeUndefined();
		expect(extractSessionFilePath({ getSessionFile: () => "   " })).toBeUndefined();
		expect(extractSessionFilePath({ getSessionFile: "nope" })).toBeUndefined();
		expect(extractSessionFilePath({ getSessionFile: () => { throw new Error("boom"); } })).toBeUndefined();
		expect(extractSessionFilePath(undefined)).toBeUndefined();
	});
});
