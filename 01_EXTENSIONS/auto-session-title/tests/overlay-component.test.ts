import { describe, expect, it, vi } from "vitest";
import { OverviewOverlayComponent } from "../src/overlay-component.js";

function stripAnsi(text: string): string {
	return text.replace(/\x1B\[[0-9;]*m/g, "");
}

describe("OverviewOverlayComponent", () => {
	it("renders a trailing top-border line and wraps long body text without ellipsis when fully expanded", () => {
		const component = new OverviewOverlayComponent({ requestRender: vi.fn() }, { fg: vi.fn((_color: string, text: string) => text) }, { title: "제목", summary: ["이 요약은 상자 폭을 넘어가더라도 말줄임표 대신 자연스럽게 줄바꿈되어야 한다고 사용자가 요청했다"] });
		const first = component.render(64);
		expect(component.render(64)).toBe(first);
		expect(component.render(68)).not.toBe(first);
		expect(first[0]).toMatch(/^╭─ 제목 ─+╮$/);
		expect(first.some((line) => line.includes("..."))).toBe(false);
		expect(first.length).toBeGreaterThan(3);
	});

	it("can collapse to a title-only chip", () => {
		const component = new OverviewOverlayComponent({ requestRender: vi.fn() }, { fg: vi.fn((_color: string, text: string) => text) }, { title: "제목", summary: ["숨겨질 본문"] }, undefined, { compact: true });
		expect(component.render(64)).toEqual([expect.stringMatching(/^╭─ 제목 ─+╮$/), expect.stringMatching(/^╰─+╯$/)]);
	});

	it("limits body height and marks truncation with an ellipsis", () => {
		const component = new OverviewOverlayComponent(
			{ requestRender: vi.fn() },
			{ fg: vi.fn((_color: string, text: string) => text) },
			{ title: "제목", summary: ["첫 줄은 그대로 보이고", "둘째 줄과 셋째 줄은 하나의 축약 신호로 정리되어야 한다"] },
			undefined,
			{ maxBodyLines: 1 },
		);
		const rendered = component.render(32).join("\n");
		expect(rendered).toContain("첫 줄은 그대로 보이고 …");
		expect(rendered).not.toContain("둘째 줄과 셋째 줄은");
	});

	it("keeps short bodies untouched when they already fit within the limit", () => {
		const component = new OverviewOverlayComponent(
			{ requestRender: vi.fn() },
			{ fg: vi.fn((_color: string, text: string) => text) },
			{ title: "제목", summary: ["한 줄 요약"] },
			undefined,
			{ maxBodyLines: 3 },
		);
		const rendered = component.render(32).join("\n");
		expect(rendered).toContain("한 줄 요약");
		expect(rendered).not.toContain("…");
	});

	it("can drop the body entirely when the allowed line budget is zero", () => {
		const component = new OverviewOverlayComponent(
			{ requestRender: vi.fn() },
			{ fg: vi.fn((_color: string, text: string) => text) },
			{ title: "제목", summary: ["숨겨질 본문"] },
			undefined,
			{ maxBodyLines: 0 },
		);
		expect(component.render(32)).toEqual([expect.stringMatching(/^╭─ 제목 ─+╮$/), expect.stringMatching(/^╰─+╯$/)]);
	});

	it("still truncates safely when only one body column is available", () => {
		const component = new OverviewOverlayComponent(
			{ requestRender: vi.fn() },
			{ fg: vi.fn((_color: string, text: string) => text) },
			{ title: "제목", summary: ["1", "2"] },
			undefined,
			{ maxBodyLines: 1 },
		);
		const rendered = component.render(3).map(stripAnsi);
		expect(rendered[1]).toMatch(/^│.│$/);
	});

	it("uses a tight ellipsis when the visible line already fills the available width", () => {
		const component = new OverviewOverlayComponent(
			{ requestRender: vi.fn() },
			{ fg: vi.fn((_color: string, text: string) => text) },
			{ title: "제목", summary: ["1234", "x"] },
			undefined,
			{ maxBodyLines: 1 },
		);
		const rendered = component.render(6).map(stripAnsi).join("\n");
		expect(rendered).toContain("│123…│");
	});

	it("invalidates and requests a render when content changes", () => {
		const tui = { requestRender: vi.fn() };
		const component = new OverviewOverlayComponent(tui, { fg: vi.fn((_color: string, text: string) => text) }, undefined, "임시 제목");
		const first = component.render(64);
		component.setContent({ title: "새 제목", summary: ["요약 내용을 새로 반영함"] }, "새 제목", { maxBodyLines: 1 });
		expect(tui.requestRender).toHaveBeenCalled();
		expect(component.render(64)).not.toBe(first);
	});
});
