import type { Ctx, PiBridge } from "../core/types.js";
import { getState } from "./store.js";
import { handleConfigChanges } from "./config-change.js";
import { currentWatchedPaths, handleFileChanges } from "./file-change.js";
import { diffSnapshots, scanConfigSnapshot, scanFileSnapshot } from "./watch-scan.js";
import { getConfigSnapshot, getFileSnapshot, setConfigSnapshot, setFileSnapshot, setWatchLoop, stopWatchLoop } from "./watch-store.js";

export async function startWatchLoop(pi: PiBridge, ctx: Ctx) {
	const state = getState();
	setConfigSnapshot(scanConfigSnapshot(ctx.cwd, state || undefined));
	setFileSnapshot(scanFileSnapshot(state?.projectRoot || ctx.cwd, state?.fileWatchBasenames || [], currentWatchedPaths()));
	const timer = setInterval(() => void tick(pi, ctx), 1000);
	timer.unref?.();
	setWatchLoop(timer);
}

export function stopBridgeWatchLoop() {
	stopWatchLoop();
}

async function tick(pi: PiBridge, ctx: Ctx) {
	const beforeConfig = getConfigSnapshot();
	const stateBeforeConfig = getState();
	const nextConfig = scanConfigSnapshot(ctx.cwd, stateBeforeConfig || undefined);
	const configChanges = diffSnapshots(beforeConfig, nextConfig).map((item) => item.path);
	const { blockedPaths } = await handleConfigChanges(pi, ctx, configChanges);
	setConfigSnapshot(restoreBlockedSnapshotPaths(beforeConfig, nextConfig, blockedPaths));
	const state = getState();
	const beforeFile = getFileSnapshot();
	const nextFile = scanFileSnapshot(state?.projectRoot || ctx.cwd, state?.fileWatchBasenames || [], currentWatchedPaths());
	setFileSnapshot(nextFile);
	await handleFileChanges(pi, ctx, diffSnapshots(beforeFile, nextFile).filter((item) => item.event !== "unlink" || beforeFile.get(item.path) !== undefined));
}

export function restoreBlockedSnapshotPaths(before: Map<string, string>, next: Map<string, string>, blockedPaths: string[]) {
	if (blockedPaths.length === 0) return next;
	const restored = new Map(next);
	for (const path of blockedPaths) {
		const previous = before.get(path);
		if (previous === undefined) restored.delete(path);
		else restored.set(path, previous);
	}
	return restored;
}
