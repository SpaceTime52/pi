import { describe, expect, it } from "vitest";
import { createApiMock, createContext } from "./helpers.ts";
import { clearSessionTitleUi, syncSessionTitleUi } from "../src/session-title-ui.ts";

describe("session title ui", () => {
	it("syncs the title into terminal chrome only", () => {
		const api = createApiMock("Ship release prep");
		const { ctx, setStatus, setTitle } = createContext({});
		syncSessionTitleUi(api.api, ctx);
		expect(setStatus).not.toHaveBeenCalled();
		expect(setTitle).toHaveBeenCalledWith("π - Ship release prep - pi-project");
	});

	it("clears the terminal title or no-ops without UI", () => {
		const hidden = createContext({});
		syncSessionTitleUi(createApiMock().api, { ...hidden.ctx, hasUI: false });
		clearSessionTitleUi({ ...hidden.ctx, hasUI: false });
		expect(hidden.setStatus).not.toHaveBeenCalled();
		expect(hidden.setTitle).not.toHaveBeenCalled();
		const shown = createContext({});
		clearSessionTitleUi(shown.ctx);
		expect(shown.setStatus).not.toHaveBeenCalled();
		expect(shown.setTitle).toHaveBeenLastCalledWith("π - pi-project");
	});
});
