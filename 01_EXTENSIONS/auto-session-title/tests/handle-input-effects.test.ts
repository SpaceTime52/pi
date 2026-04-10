import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearOverviewUi, refreshOverview } from "../src/handlers.js";
import { stubContext, stubRuntime } from "./helpers.js";

const { resolveSessionOverview } = vi.hoisted(() => ({ resolveSessionOverview: vi.fn() }));
vi.mock("../src/summarize.js", async () => {
	const actual = await vi.importActual<typeof import("../src/summarize.js")>("../src/summarize.js");
	return { ...actual, resolveSessionOverview };
});

describe("refreshOverview effects", () => {
	beforeEach(() => {
		resolveSessionOverview.mockReset();
		clearOverviewUi(new Set(), stubContext());
	});

	it("persists and applies a new overview after agent_end", async () => {
		resolveSessionOverview.mockResolvedValue({
			title: "세션 요약 제목",
			summary: ["Goal: 오버레이 표시", "Done: idle 시점 갱신", "Note: 우상단 패널", "Next: 테스트"],
		});
		const runtime = stubRuntime();
		const ctx = stubContext([
			{ type: "message", id: "1", message: { role: "user", content: [{ type: "text", text: "오버레이를 만들어줘" }] } },
			{ type: "message", id: "2", message: { role: "assistant", content: [{ type: "text", text: "구현하겠습니다" }] } },
		]);
		await refreshOverview(new Set(), runtime, ctx);
		expect(runtime.appendEntry).toHaveBeenCalledWith("auto-session-title.overview", {
			title: "세션 요약 제목",
			summary: ["Goal: 오버레이 표시", "Done: idle 시점 갱신", "Note: 우상단 패널", "Next: 테스트"],
		});
		expect(runtime.setSessionName).toHaveBeenCalledWith("세션 요약 제목");
		expect(ctx.ui.setTitle).toHaveBeenCalledWith("π - 세션 요약 제목");
		expect(ctx.ui.custom).toHaveBeenCalledTimes(1);
		expect(ctx.overlay.component?.render(36).join("\n")).toContain("제목: 세션 요약 제목");
	});

	it("does not append duplicate overview snapshots", async () => {
		resolveSessionOverview.mockResolvedValue({
			title: "기존 제목",
			summary: ["Goal: A", "Done: B", "Note: C", "Next: D"],
		});
		const runtime = stubRuntime("기존 제목");
		const ctx = stubContext([
			{ type: "custom", id: "ov1", customType: "auto-session-title.overview", data: { title: "기존 제목", summary: ["Goal: A", "Done: B", "Note: C", "Next: D"] } },
			{ type: "message", id: "3", message: { role: "assistant", content: [{ type: "text", text: "추가 변화 없음" }] } },
		]);
		await refreshOverview(new Set(), runtime, ctx);
		expect(runtime.appendEntry).not.toHaveBeenCalled();
		expect(runtime.setSessionName).not.toHaveBeenCalled();
		expect(ctx.ui.setTitle).toHaveBeenCalledWith("π - 기존 제목");
		expect(ctx.overlay.component?.render(36).join("\n")).toContain("제목: 기존 제목");
	});

	it("skips session name writes when the runtime already has the same title", async () => {
		resolveSessionOverview.mockResolvedValue({
			title: "동일 제목",
			summary: ["Goal: A", "Done: B", "Note: C", "Next: D"],
		});
		const runtime = stubRuntime("동일 제목");
		const ctx = stubContext([{ type: "message", id: "1", message: { role: "assistant", content: [{ type: "text", text: "업데이트" }] } }]);
		await refreshOverview(new Set(), runtime, ctx);
		expect(runtime.setSessionName).not.toHaveBeenCalled();
		expect(runtime.appendEntry).toHaveBeenCalledTimes(1);
	});
});
