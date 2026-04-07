import { describe, expect, it } from "vitest";
import { handleInput } from "../src/handlers.js";
import { makeInput, stubContext, stubRuntime } from "./helpers.js";

describe("handleInput guards", () => {
	it("does not rename when the runtime already has a name", async () => {
		const runtime = stubRuntime("Existing");
		await handleInput(runtime, makeInput("New request"), stubContext());
		expect(runtime.setSessionName).not.toHaveBeenCalled();
	});

	it("does not rename when the session manager already has a name", async () => {
		const ctx = stubContext({
			sessionManager: { getSessionName: () => "Existing", getEntries: () => [], getCwd: () => "/Users/me/Desktop/pi" },
		});
		const runtime = stubRuntime();
		await handleInput(runtime, makeInput("New request"), ctx);
		expect(runtime.setSessionName).not.toHaveBeenCalled();
	});

	it("does not rename when a user message already exists", async () => {
		const ctx = stubContext({
			sessionManager: { getSessionName: () => undefined, getEntries: () => [{ type: "message", message: { role: "user" } }], getCwd: () => "/Users/me/Desktop/pi" },
		});
		const runtime = stubRuntime();
		await handleInput(runtime, makeInput("New request"), ctx);
		expect(runtime.setSessionName).not.toHaveBeenCalled();
	});

	it("does not treat assistant messages as prior user input", async () => {
		const ctx = stubContext({
			sessionManager: { getSessionName: () => undefined, getEntries: () => [{ type: "message", message: { role: "assistant" } }], getCwd: () => "/Users/me/Desktop/pi" },
		});
		const runtime = stubRuntime();
		await handleInput(runtime, makeInput("Investigate assistant history"), ctx);
		expect(runtime.setSessionName).toHaveBeenCalledWith("Investigate assistant history");
	});

	it("ignores extension-delivered input and empty derived titles", async () => {
		const runtime = stubRuntime();
		await handleInput(runtime, makeInput("Internal message", "extension"), stubContext());
		await handleInput(runtime, makeInput("```ts\nconst x = 1\n```"), stubContext());
		expect(runtime.setSessionName).not.toHaveBeenCalled();
	});
});
