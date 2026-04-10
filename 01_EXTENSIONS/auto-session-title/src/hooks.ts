import { clearOverviewUi, refreshOverview, restoreOverview, type OverviewContext, type OverviewRuntime } from "./handlers.js";

const inFlight = new Set<string>();

function runtime(getSessionName: OverviewRuntime["getSessionName"], setSessionName: OverviewRuntime["setSessionName"], appendEntry: OverviewRuntime["appendEntry"]): OverviewRuntime {
	return { getSessionName, setSessionName, appendEntry };
}

export function createSessionStartHandler(getSessionName: OverviewRuntime["getSessionName"], setSessionName: OverviewRuntime["setSessionName"], appendEntry: OverviewRuntime["appendEntry"]) {
	return async (_event: object, ctx: OverviewContext) => restoreOverview(runtime(getSessionName, setSessionName, appendEntry), ctx);
}

export function createAgentEndHandler(getSessionName: OverviewRuntime["getSessionName"], setSessionName: OverviewRuntime["setSessionName"], appendEntry: OverviewRuntime["appendEntry"]) {
	return async (_event: object, ctx: OverviewContext) => refreshOverview(inFlight, runtime(getSessionName, setSessionName, appendEntry), ctx);
}

export function createSessionTreeHandler(getSessionName: OverviewRuntime["getSessionName"], setSessionName: OverviewRuntime["setSessionName"], appendEntry: OverviewRuntime["appendEntry"]) {
	return async (_event: object, ctx: OverviewContext) => restoreOverview(runtime(getSessionName, setSessionName, appendEntry), ctx);
}

export function createSessionShutdownHandler() {
	return async (_event: object, _ctx: OverviewContext) => clearOverviewUi(inFlight);
}
