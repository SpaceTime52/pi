import { beforeEach, describe, expect, it } from "vitest";
import { clearOverviewUi, previewOverviewFromInput } from "../src/handlers.js";
import { stubContext } from "./helpers.js";

function renderPreview(ctx: ReturnType<typeof stubContext>): string {
	return ctx.overlay.component?.render(80).join("\n") ?? ctx.widget.component?.render(80).join("\n") ?? "";
}

describe("previewOverviewFromInput greeting guards", () => {
	beforeEach(() => clearOverviewUi(new Set(), stubContext()));
	it("does not strip greeting-like prefixes when they are not polite wrappers", () => {
		const ctx = stubContext();
		expect(previewOverviewFromInput(ctx, "Hello branch summary note")).toBe(true);
		expect(renderPreview(ctx)).toContain("Hello branch summary note");
	});
});
