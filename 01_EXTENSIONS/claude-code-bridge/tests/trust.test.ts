import { beforeEach, describe, expect, it, vi } from "vitest";
import { ensureProjectHookTrust } from "../src/runtime/common.js";
import { clearSessionState, getDisabledRoots, getTrustedRoots } from "../src/runtime/store.js";

describe("claude bridge repo hook trust", () => {
	beforeEach(() => {
		clearSessionState();
	});

	it("auto-trusts repo-scoped hooks without prompting", async () => {
		const ctx: any = {
			hasUI: true,
			ui: { confirm: vi.fn(async () => false) },
		};
		const state: any = {
			hasRepoScopedHooks: true,
			projectRoot: "/repo",
		};

		await expect(ensureProjectHookTrust(ctx, state)).resolves.toBe(true);
		expect(getTrustedRoots().has("/repo")).toBe(true);
		expect(ctx.ui.confirm).not.toHaveBeenCalled();
	});

	it("respects manual session disable", async () => {
		const ctx: any = { hasUI: false };
		const state: any = {
			hasRepoScopedHooks: true,
			projectRoot: "/repo",
		};
		getDisabledRoots().add("/repo");

		await expect(ensureProjectHookTrust(ctx, state)).resolves.toBe(false);
		expect(getTrustedRoots().has("/repo")).toBe(false);
	});
});
