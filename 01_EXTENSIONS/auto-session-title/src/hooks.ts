import { handleBeforeAgentStart, handleInput, type PendingSessionTitles, type SessionTitleRuntime } from "./handlers.js";

const pending: PendingSessionTitles = new Map();

function runtime(
	getSessionName: SessionTitleRuntime["getSessionName"],
	setSessionName: SessionTitleRuntime["setSessionName"],
): SessionTitleRuntime {
	return { getSessionName, setSessionName };
}

export function createInputHandler(
	getSessionName: SessionTitleRuntime["getSessionName"],
	setSessionName: SessionTitleRuntime["setSessionName"],
) {
	return async (event: Parameters<typeof handleInput>[2], ctx: Parameters<typeof handleInput>[3]) => {
		handleInput(pending, runtime(getSessionName, setSessionName), event, ctx);
	};
}

export function createBeforeAgentStartHandler(
	getSessionName: SessionTitleRuntime["getSessionName"],
	setSessionName: SessionTitleRuntime["setSessionName"],
) {
	return async (_event: unknown, ctx: Parameters<typeof handleBeforeAgentStart>[2]) => {
		await handleBeforeAgentStart(pending, runtime(getSessionName, setSessionName), ctx);
	};
}

export function createSessionShutdownHandler() {
	return async (_event: unknown, ctx: Parameters<typeof handleBeforeAgentStart>[2]) => void pending.delete(ctx.sessionManager.getSessionId());
}
