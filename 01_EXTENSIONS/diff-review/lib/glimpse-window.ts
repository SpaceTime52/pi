import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import { createInterface } from "node:readline";
import type { GlimpseOpenOptions } from "glimpseui";

interface NativeHostInfo { path: string; extraArgs?: string[]; buildHint?: string }
interface GlimpseMessage { type?: string; data?: unknown }
export interface QuietGlimpseWindow {
	on(event: "message", listener: (data: unknown) => void): this;
	on(event: "closed", listener: () => void): this;
	on(event: "error", listener: (error: Error) => void): this;
	removeListener(event: "message", listener: (data: unknown) => void): this;
	removeListener(event: "closed", listener: () => void): this;
	removeListener(event: "error", listener: (error: Error) => void): this;
	send(js: string): void;
	close(): void;
}

class QuietWindow extends EventEmitter implements QuietGlimpseWindow {
	#proc: ChildProcessWithoutNullStreams;
	#closed = false;
	constructor(proc: ChildProcessWithoutNullStreams, html: string) {
		super();
		this.#proc = proc;
		createInterface({ input: proc.stdout, crlfDelay: Infinity }).on("line", (line) => this.#onLine(line, html));
		proc.on("error", (error) => this.emit("error", error));
		proc.on("exit", () => this.#markClosed());
	}
	#onLine(line: string, html: string): void {
		let message: GlimpseMessage;
		try { message = JSON.parse(line) as GlimpseMessage; } catch { return void this.emit("error", new Error(`Malformed glimpse line: ${line}`)); }
		if (message.type === "ready") return void this.#write({ type: "html", html: Buffer.from(html).toString("base64") });
		if (message.type === "message") this.emit("message", message.data);
		if (message.type === "closed") this.#markClosed();
	}
	#markClosed(): void { if (!this.#closed) { this.#closed = true; this.emit("closed"); } }
	#write(payload: Record<string, unknown>): void { if (!this.#closed) this.#proc.stdin.write(`${JSON.stringify(payload)}\n`); }
	send(js: string): void { this.#write({ type: "eval", js }); }
	close(): void { this.#write({ type: "close" }); }
}

async function getNativeHost(): Promise<NativeHostInfo> {
	return ((await import("glimpseui")) as { getNativeHostInfo: () => NativeHostInfo }).getNativeHostInfo();
}

export async function openQuietGlimpse(html: string, options: GlimpseOpenOptions = {}): Promise<QuietGlimpseWindow> {
	const host = await getNativeHost();
	if (!existsSync(host.path)) throw new Error(`Glimpse host not found at '${host.path}'.${host.buildHint ? ` ${host.buildHint}` : ""}`);
	const args = [options.width && `--width=${options.width}`, options.height && `--height=${options.height}`, options.title && "--title", options.title].filter((value): value is string => typeof value === "string");
	return new QuietWindow(spawn(host.path, [...(host.extraArgs ?? []), ...args], { stdio: ["pipe", "pipe", "pipe"], windowsHide: process.platform === "win32", env: { ...process.env, OS_ACTIVITY_MODE: process.env.OS_ACTIVITY_MODE ?? "disable" } }), html);
}
