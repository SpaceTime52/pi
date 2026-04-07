import { describe, expect, it } from "vitest";
import { handleInput } from "../src/handlers.js";
import { makeInput, stubContext, stubRuntime } from "./helpers.js";

describe("handleInput effects", () => {
	it("stores the first user input by session id", () => {
		const pending = new Map<string, string>();
		handleInput(pending, stubRuntime(), makeInput("Fix footer title handling"), stubContext());
		expect(pending.get("session-1")).toBe("Fix footer title handling");
	});

	it("replaces a pending title candidate for the same session", () => {
		const pending = new Map<string, string>([["session-1", "Old"]]);
		handleInput(pending, stubRuntime(), makeInput("New title input"), stubContext());
		expect(pending.get("session-1")).toBe("New title input");
	});
});
