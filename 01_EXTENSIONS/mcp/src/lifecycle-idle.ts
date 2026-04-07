interface IdleConn {
	name: string;
	lastUsedAt: number;
	status: string;
	inFlight: number;
}

interface IdleOpts {
	connections: Map<string, IdleConn>;
	servers: Record<string, { lifecycle?: string; idleTimeout?: number }>;
	closeFn: (name: string) => Promise<void>;
	timeoutMs: number;
	intervalMs: number;
}

let timer: ReturnType<typeof setInterval> | null = null;

function checkIdle(opts: IdleOpts): void {
	const now = Date.now();
	for (const [name, conn] of opts.connections) {
		if (conn.status !== "connected") continue;
		const serverDef = opts.servers[name];
		if (serverDef?.lifecycle === "keep-alive") continue;
		const timeout = serverDef?.idleTimeout ?? opts.timeoutMs;
		if (conn.inFlight > 0) continue;
		if (now - conn.lastUsedAt > timeout) {
			opts.closeFn(name).catch(() => {});
		}
	}
}

export function startIdleTimer(opts: IdleOpts): void {
	stopIdleTimer();
	timer = setInterval(() => checkIdle(opts), opts.intervalMs);
}

export function stopIdleTimer(): void {
	if (timer !== null) {
		clearInterval(timer);
		timer = null;
	}
}
