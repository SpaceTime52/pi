import { describe, expect, it, vi } from "vitest";
import { OverviewOverlayComponent } from "../src/overlay-component.js";

describe("OverviewOverlayComponent", () => {
	it("reuses cached lines for the same width and recalculates when the width changes", () => {
		const component = new OverviewOverlayComponent({ requestRender: vi.fn() }, { fg: vi.fn((_color: string, text: string) => text) }, { title: "제목", summary: ["Goal: A"] });
		const first = component.render(36);
		expect(component.render(36)).toBe(first);
		expect(component.render(40)).not.toBe(first);
	});

	it("invalidates and requests a render when content changes", () => {
		const tui = { requestRender: vi.fn() };
		const component = new OverviewOverlayComponent(tui, { fg: vi.fn((_color: string, text: string) => text) }, undefined, "임시 제목");
		const first = component.render(36);
		component.setContent({ title: "새 제목", summary: ["Done: B"] }, "새 제목");
		expect(tui.requestRender).toHaveBeenCalled();
		expect(component.render(36)).not.toBe(first);
	});
});
