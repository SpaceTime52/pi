export interface ShutdownOps {
	saveCache: () => Promise<void>;
	closeAll: () => Promise<void>;
	stopIdle: () => void;
	stopKeepalive: () => void;
	resetState: () => void;
}

function isShutdownOps(v: unknown): v is ShutdownOps {
	return typeof v === "object" && v !== null && "closeAll" in v;
}

export function onSessionShutdown(opsOrPi?: unknown) {
	const ops = isShutdownOps(opsOrPi) ? opsOrPi : undefined;
	return async (_event: unknown, _ctx: unknown): Promise<void> => {
		if (!ops) return;
		ops.stopIdle();
		ops.stopKeepalive();
		try { await ops.saveCache(); } catch { /* silent */ }
		try { await ops.closeAll(); } catch { /* silent */ }
		ops.resetState();
	};
}
