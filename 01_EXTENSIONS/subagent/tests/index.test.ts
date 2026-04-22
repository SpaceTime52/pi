import { describe, expect, it } from "vitest";
import extension from "../src/index";

describe("subagents wrapper", () => {
	it("exports upstream extension", () => {
		expect(typeof extension).toBe("function");
	});
});
