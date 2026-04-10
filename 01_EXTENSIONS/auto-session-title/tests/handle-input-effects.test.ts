import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearOverviewUi, refreshOverview } from "../src/handlers.js";
import { stubContext, stubRuntime } from "./helpers.js";

const { resolveSessionOverview } = vi.hoisted(() => ({ resolveSessionOverview: vi.fn() }));
vi.mock("../src/summarize.js", async () => ({ ...(await vi.importActual<typeof import("../src/summarize.js")>("../src/summarize.js")), resolveSessionOverview }));

describe("refreshOverview effects", () => {
	beforeEach(() => {
		resolveSessionOverview.mockReset();
		clearOverviewUi(new Set(), stubContext());
	});

	it("persists and applies a new overview after agent_end", async () => {
		resolveSessionOverview.mockResolvedValue({ title: "세션 요약 제목", summary: ["우상단 오버레이를 유지함", "idle 시점에 제목을 갱신함", "resume 복원을 점검 중"] });
		const runtime = stubRuntime();
		const ctx = stubContext([{ type: "message", id: "1", message: { role: "user", content: [{ type: "text", text: "오버레이를 만들어줘" }] } }, { type: "message", id: "2", message: { role: "assistant", content: [{ type: "text", text: "구현하겠습니다" }] } }]);
		await refreshOverview(new Set(), runtime, ctx);
		expect(runtime.appendEntry).toHaveBeenCalledWith("auto-session-title.overview", { title: "세션 요약 제목", summary: ["우상단 오버레이를 유지함", "idle 시점에 제목을 갱신함", "resume 복원을 점검 중"], coveredThroughEntryId: "2" });
		expect(runtime.setSessionName).toHaveBeenCalledWith("세션 요약 제목");
		expect(ctx.ui.setTitle).toHaveBeenCalledWith("π - 세션 요약 제목");
		expect(ctx.overlay.component?.render(36).join("\n")).toContain("세션 요약 제목");
	});

	it("advances the checkpoint even when the visible overview stays the same", async () => {
		resolveSessionOverview.mockResolvedValue({ title: "기존 제목", summary: ["오버레이 배치를 유지함", "다음 메시지를 기다리는 중"] });
		const runtime = stubRuntime("기존 제목");
		await refreshOverview(new Set(), runtime, stubContext([{ type: "custom", id: "ov1", customType: "auto-session-title.overview", data: { title: "기존 제목", summary: ["오버레이 배치를 유지함", "다음 메시지를 기다리는 중"], coveredThroughEntryId: "2" } }, { type: "message", id: "3", message: { role: "assistant", content: [{ type: "text", text: "첫 변경" }] } }]));
		await refreshOverview(new Set(), runtime, stubContext([{ type: "custom", id: "ov1", customType: "auto-session-title.overview", data: { title: "기존 제목", summary: ["오버레이 배치를 유지함", "다음 메시지를 기다리는 중"], coveredThroughEntryId: "2" } }, { type: "message", id: "3", message: { role: "assistant", content: [{ type: "text", text: "첫 변경" }] } }, { type: "custom", id: "ov2", customType: "auto-session-title.overview", data: { title: "기존 제목", summary: ["오버레이 배치를 유지함", "다음 메시지를 기다리는 중"], coveredThroughEntryId: "3" } }, { type: "message", id: "4", message: { role: "assistant", content: [{ type: "text", text: "둘째 변경" }] } }]));
		expect(runtime.appendEntry).toHaveBeenNthCalledWith(1, "auto-session-title.overview", { title: "기존 제목", summary: ["오버레이 배치를 유지함", "다음 메시지를 기다리는 중"], coveredThroughEntryId: "3" });
		expect(runtime.appendEntry).toHaveBeenNthCalledWith(2, "auto-session-title.overview", { title: "기존 제목", summary: ["오버레이 배치를 유지함", "다음 메시지를 기다리는 중"], coveredThroughEntryId: "4" });
		expect(resolveSessionOverview.mock.calls[1][0].recentText).not.toContain("첫 변경");
		expect(resolveSessionOverview.mock.calls[1][0].recentText).toContain("둘째 변경");
	});

	it("skips session name writes when the runtime already has the same title", async () => {
		resolveSessionOverview.mockResolvedValue({ title: "동일 제목", summary: ["현재 상태를 간단히 보여줌"] });
		const runtime = stubRuntime("동일 제목");
		const ctx = stubContext([{ type: "message", id: "1", message: { role: "assistant", content: [{ type: "text", text: "업데이트" }] } }]);
		await refreshOverview(new Set(), runtime, ctx);
		expect(runtime.setSessionName).not.toHaveBeenCalled();
		expect(runtime.appendEntry).toHaveBeenCalledWith("auto-session-title.overview", { title: "동일 제목", summary: ["현재 상태를 간단히 보여줌"], coveredThroughEntryId: "1" });
	});
});
