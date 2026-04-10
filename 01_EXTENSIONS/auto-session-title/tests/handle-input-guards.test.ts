import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearOverviewUi, refreshOverview } from "../src/handlers.js";
import { stubContext, stubRuntime } from "./helpers.js";

const { resolveSessionOverview } = vi.hoisted(() => ({ resolveSessionOverview: vi.fn() }));
vi.mock("../src/summarize.js", async () => ({ ...(await vi.importActual<typeof import("../src/summarize.js")>("../src/summarize.js")), resolveSessionOverview }));

describe("refreshOverview guards", () => {
	beforeEach(() => {
		resolveSessionOverview.mockReset();
		clearOverviewUi(new Set(), stubContext());
	});

	it("returns immediately when a refresh for the same session is already running", async () => {
		const inFlight = new Set<string>(["session-1"]);
		await refreshOverview(inFlight, stubRuntime(), stubContext([{ type: "message", id: "1", message: { role: "assistant", content: [{ type: "text", text: "업데이트" }] } }]));
		expect(resolveSessionOverview).not.toHaveBeenCalled();
		expect(inFlight.has("session-1")).toBe(true);
	});

	it("falls back to the previous overview when there is no recent text or summarization fails", async () => {
		const runtime = stubRuntime();
		const previous = { type: "custom", id: "ov1", customType: "auto-session-title.overview", data: { title: "이전 제목", summary: ["오버레이 배치를 유지함", "resume 복원을 붙임"] } };
		const ctx = stubContext([previous]);
		await refreshOverview(new Set(), runtime, ctx);
		expect(resolveSessionOverview).not.toHaveBeenCalled();
		expect(ctx.ui.setTitle).toHaveBeenCalledWith("π - 이전 제목");
		resolveSessionOverview.mockResolvedValue(undefined);
		await refreshOverview(new Set(), runtime, stubContext([previous, { type: "message", id: "2", message: { role: "assistant", content: [{ type: "text", text: "새 출력" }] } }]));
		expect(runtime.appendEntry).not.toHaveBeenCalled();
	});

	it("advances the stored checkpoint even when new entries add no transcript text", async () => {
		const runtime = stubRuntime();
		const previous = { type: "custom", id: "ov1", customType: "auto-session-title.overview", data: { title: "이전 제목", summary: ["오버레이 배치를 유지함", "resume 복원을 붙임"], coveredThroughEntryId: "missing" } };
		const ctx = stubContext([previous, { type: "custom", id: "c2", customType: "other", data: { flag: true } }]);
		await refreshOverview(new Set(), runtime, ctx);
		expect(resolveSessionOverview).not.toHaveBeenCalled();
		expect(runtime.appendEntry).toHaveBeenCalledWith("auto-session-title.overview", { title: "이전 제목", summary: ["오버레이 배치를 유지함", "resume 복원을 붙임"], coveredThroughEntryId: "c2" });
		expect(ctx.ui.setTitle).toHaveBeenCalledWith("π - 이전 제목");
	});

	it("cleans up in-flight state even when summarization throws", async () => {
		resolveSessionOverview.mockImplementationOnce(async () => { throw new Error("boom"); });
		const inFlight = new Set<string>();
		await expect(refreshOverview(inFlight, stubRuntime(), stubContext([{ type: "message", id: "1", message: { role: "assistant", content: [{ type: "text", text: "업데이트" }] } }]))).rejects.toThrow("boom");
		expect(inFlight.size).toBe(0);
	});
});
