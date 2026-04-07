import { describe, expect, it } from "vitest";
import { handleInput } from "../src/handlers.js";
import { makeInput, stubContext, stubRuntime } from "./helpers.js";

describe("handleInput effects", () => {
	it("sets the session name from the first user input", async () => {
		const runtime = stubRuntime();
		const ctx = stubContext();
		await handleInput(runtime, makeInput("Fix footer title handling"), ctx);
		expect(runtime.setSessionName).toHaveBeenCalledWith("Fix footer title handling");
		expect(ctx.ui.setTitle).toHaveBeenCalledWith("π - Fix footer title handling - pi");
	});

	it("uses sessionManager.getCwd when ctx.cwd is empty", async () => {
		const runtime = stubRuntime();
		const ctx = stubContext({ cwd: "" });
		await handleInput(runtime, makeInput("Investigate cwd fallback"), ctx);
		expect(ctx.ui.setTitle).toHaveBeenCalledWith("π - Investigate cwd fallback - pi");
	});

	it("sets the session name without touching UI when no UI is available", async () => {
		const runtime = stubRuntime();
		const ctx = stubContext({ hasUI: false });
		await handleInput(runtime, makeInput("Investigate notify footer sync", "rpc"), ctx);
		expect(runtime.setSessionName).toHaveBeenCalledWith("Investigate notify footer sync");
		expect(ctx.ui.setTitle).not.toHaveBeenCalled();
	});
});
