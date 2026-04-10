import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	createAgentEndHandler,
	createSessionShutdownHandler,
	createSessionStartHandler,
	createSessionTreeHandler,
} from "../src/hooks.js";
import { stubContext, stubRuntime } from "./helpers.js";

const { clearOverviewUi, refreshOverview, restoreOverview } = vi.hoisted(() => ({
	clearOverviewUi: vi.fn(),
	refreshOverview: vi.fn(),
	restoreOverview: vi.fn(),
}));

vi.mock("../src/handlers.js", async () => {
	const actual = await vi.importActual<typeof import("../src/handlers.js")>("../src/handlers.js");
	return { ...actual, clearOverviewUi, refreshOverview, restoreOverview };
});

describe("hooks", () => {
	beforeEach(() => {
		clearOverviewUi.mockReset();
		refreshOverview.mockReset();
		restoreOverview.mockReset();
		refreshOverview.mockResolvedValue(undefined);
	});

	it("restores the overview on session start and tree navigation", async () => {
		const runtime = stubRuntime();
		const ctx = stubContext();
		await createSessionStartHandler(runtime.getSessionName, runtime.setSessionName, runtime.appendEntry)({}, ctx);
		await createSessionTreeHandler(runtime.getSessionName, runtime.setSessionName, runtime.appendEntry)({}, ctx);
		expect(restoreOverview).toHaveBeenCalledTimes(2);
	});

	it("refreshes the overview after the agent becomes idle", async () => {
		const runtime = stubRuntime();
		const ctx = stubContext();
		await createAgentEndHandler(runtime.getSessionName, runtime.setSessionName, runtime.appendEntry)({}, ctx);
		expect(refreshOverview).toHaveBeenCalledWith(expect.any(Set), expect.objectContaining({
			getSessionName: runtime.getSessionName,
			setSessionName: runtime.setSessionName,
			appendEntry: runtime.appendEntry,
		}), ctx);
	});

	it("clears overview UI on session shutdown", async () => {
		await createSessionShutdownHandler()({}, stubContext());
		expect(clearOverviewUi).toHaveBeenCalledWith(expect.any(Set));
	});
});
