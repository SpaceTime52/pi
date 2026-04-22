import { describe, expect, it } from "vitest";
import { createApiMock, createContext } from "./helpers.ts";
import { clearSessionTitleUi, syncSessionTitleUi } from "../src/session-title-ui.ts";

describe("session title ui", () => {
	it("syncs the title into status and terminal chrome", () => {
		const api = createApiMock("Ship release prep");
		const { ctx, setStatus, setTitle } = createContext({});
		syncSessionTitleUi(api.api, ctx);
		expect(setStatus).toHaveBeenCalledWith("session-title", "Ship release prep");
		expect(setTitle).toHaveBeenCalledWith("π - Ship release prep - pi-project");
	});

	it("clears the chrome or no-ops without UI", () => {
		const hidden = createContext({});
		syncSessionTitleUi(createApiMock().api, { ...hidden.ctx, hasUI: false });
		clearSessionTitleUi({ ...hidden.ctx, hasUI: false });
		expect(hidden.setStatus).not.toHaveBeenCalled();
		const shown = createContext({});
		clearSessionTitleUi(shown.ctx);
		expect(shown.setStatus).toHaveBeenCalledWith("session-title", undefined);
		expect(shown.setTitle).toHaveBeenLastCalledWith("π - pi-project");
	});
});
