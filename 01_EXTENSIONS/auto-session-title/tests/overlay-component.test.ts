import { describe, expect, it, vi } from "vitest";
import { OverviewOverlayComponent } from "../src/overlay-component.js";

describe("OverviewOverlayComponent", () => {
	it("renders a header divider and recalculates when the width changes", () => {
		const component = new OverviewOverlayComponent({ requestRender: vi.fn() }, { fg: vi.fn((_color: string, text: string) => text) }, { title: "제목", summary: ["현재 상태를 짧게 보여줌"] });
		const first = component.render(64);
		expect(component.render(64)).toBe(first);
		expect(component.render(68)).not.toBe(first);
		expect(first.join("\n")).toContain("제목");
		expect(first[1]).toBe(`├${"─".repeat(62)}┤`);
	});

	it("invalidates and requests a render when content changes", () => {
		const tui = { requestRender: vi.fn() };
		const component = new OverviewOverlayComponent(tui, { fg: vi.fn((_color: string, text: string) => text) }, undefined, "임시 제목");
		const first = component.render(64);
		component.setContent({ title: "새 제목", summary: ["요약 내용을 새로 반영함"] }, "새 제목");
		expect(tui.requestRender).toHaveBeenCalled();
		expect(component.render(64)).not.toBe(first);
	});
});
