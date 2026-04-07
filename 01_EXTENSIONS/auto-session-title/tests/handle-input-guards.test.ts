import { describe, expect, it } from "vitest";
import { handleInput } from "../src/handlers.js";
import { makeInput, stubContext, stubRuntime } from "./helpers.js";

describe("handleInput guards", () => {
	it("ignores extension-delivered and command-style input", () => {
		const pending = new Map<string, string>();
		handleInput(pending, stubRuntime(), makeInput("Internal", "extension"), stubContext());
		handleInput(pending, stubRuntime(), makeInput("/name custom"), stubContext());
		handleInput(pending, stubRuntime(), makeInput("!git status"), stubContext());
		expect(pending.size).toBe(0);
	});

	it("does not store input when the session already has a title", () => {
		const pending = new Map<string, string>();
		handleInput(pending, stubRuntime("Existing"), makeInput("New request"), stubContext());
		handleInput(pending, stubRuntime(), makeInput("New request"), stubContext({ sessionManager: { getSessionId: () => "session-1", getSessionName: () => "Existing", getEntries: () => [], getCwd: () => "/Users/me/Desktop/pi" } }));
		expect(pending.size).toBe(0);
	});

	it("does not store input when a prior user message already exists", () => {
		const pending = new Map<string, string>();
		const ctx = stubContext({ sessionManager: { getSessionId: () => "session-1", getSessionName: () => undefined, getEntries: () => [{ type: "message", message: { role: "user" } }], getCwd: () => "/Users/me/Desktop/pi" } });
		handleInput(pending, stubRuntime(), makeInput("New request"), ctx);
		expect(pending.size).toBe(0);
	});
});
