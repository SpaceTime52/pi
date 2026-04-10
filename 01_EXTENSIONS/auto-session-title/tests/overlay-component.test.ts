import { describe, expect, it, vi } from "vitest";
import { OverviewOverlayComponent } from "../src/overlay-component.js";

describe("OverviewOverlayComponent", () => {
	it("reuses cached lines for the same width and recalculates when the width changes", () => {
		const component = new OverviewOverlayComponent({ requestRender: vi.fn() }, { fg: vi.fn((_color: string, text: string) => text) }, { title: "제목", summary: ["현재 상태를 짧게 보여줌"] });
		const first = component.render(48);
		expect(component.render(48)).toBe(first);
		expect(component.render(52)).not.toBe(first);
		expect(first.join("\n")).toContain("제목");
	});

	it("invalidates and requests a render when content changes", () => {
		const tui = { requestRender: vi.fn() };
		const component = new OverviewOverlayComponent(tui, { fg: vi.fn((_color: string, text: string) => text) }, undefined, "임시 제목");
		const first = component.render(48);
		component.setContent({ title: "새 제목", summary: ["요약 내용을 새로 반영함"] }, "새 제목");
		expect(tui.requestRender).toHaveBeenCalled();
		expect(component.render(48)).not.toBe(first);
	});
});
