import { describe, expect, it } from "vitest";
import { commandFromInput, getTrackedRef, messageOf, notify } from "../src/runtime-helpers.ts";
import { createContext, trackedState } from "./helpers.ts";

describe("runtime helpers", () => {
	it("formats errors and command input", () => {
		expect(messageOf(new Error("boom"))).toBe("boom");
		expect(messageOf("boom")).toBe("boom");
		expect(commandFromInput({ command: "gh pr create" })).toBe("gh pr create");
		expect(commandFromInput({})).toBe("");
	});

	it("notifies only when UI exists", () => {
		const visible = createContext();
		notify(visible, "hi", "warning");
		expect(visible.ui.notify).toHaveBeenCalledWith("hi", "warning");
		const hidden = createContext(false);
		notify(hidden, "hi");
		expect(hidden.ui.notify).not.toHaveBeenCalled();
	});

	it("chooses tracked refs", () => {
		const pr = trackedState().pr;
		if (!pr) throw new Error("missing test PR");
		expect(getTrackedRef({ trackedRef: "explicit", pr })).toBe("explicit");
		expect(getTrackedRef({ pr })).toBe("https://github.com/acme/web/pull/63");
		expect(getTrackedRef({ pr: { ...pr, url: undefined, number: 64 } })).toBe("64");
		expect(getTrackedRef({})).toBeUndefined();
	});
});
