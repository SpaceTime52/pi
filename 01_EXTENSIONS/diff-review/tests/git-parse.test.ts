import { describe, expect, it } from "vitest";
import { parseNameStatus } from "../src/git-parse.ts";

describe("parseNameStatus", () => {
	it("parses changed paths and filters minified files", () => {
		const files = parseNameStatus(["M\tsrc/a.ts", "A\tsrc/new.ts", "D\tsrc/old.ts", "R100\tsrc/b.ts\tsrc/c.ts", "M\tdist/app.min.js"].join("\n"));
		expect(files.map((file) => `${file.status}:${file.path}`)).toEqual(["modified:src/a.ts", "renamed:src/c.ts", "added:src/new.ts", "deleted:src/old.ts"]);
	});

	it("returns an empty list for unsupported lines", () => {
		expect(parseNameStatus("??\tfile.txt\nM\t\nR100\tone.ts\tstyle.min.css\n")).toEqual([]);
	});
});
