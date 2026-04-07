import { METADATA_CACHE_TTL_MS } from "./constants.js";

export interface ServerCacheEntry {
	tools: unknown;
	savedAt: number;
}

export interface MetadataCache {
	version: number;
	servers: Record<string, ServerCacheEntry>;
	configHash: string;
}

interface CacheFsOps {
	existsSync(p: string): boolean;
	readFileSync(p: string): string;
	writeFileSync(p: string, data: string): void;
	renameSync(src: string, dest: string): void;
	getPid(): number;
}

function isRecord(v: unknown): v is Record<string, unknown> {
	return typeof v === "object" && v !== null && !Array.isArray(v);
}

function validateCache(parsed: unknown): MetadataCache | null {
	if (!isRecord(parsed)) return null;
	if (typeof parsed.version !== "number") return null;
	if (typeof parsed.configHash !== "string") return null;
	if (!isRecord(parsed.servers)) return null;
	return {
		version: parsed.version,
		servers: parsed.servers as Record<string, ServerCacheEntry>,
		configHash: parsed.configHash,
	};
}

export function loadMetadataCache(path: string, fs: CacheFsOps): MetadataCache | null {
	if (!fs.existsSync(path)) return null;
	try {
		const raw = fs.readFileSync(path);
		return validateCache(JSON.parse(raw));
	} catch {
		return null;
	}
}

export function saveMetadataCache(path: string, cache: MetadataCache, fs: CacheFsOps): void {
	const tmp = `${path}.${fs.getPid()}.tmp`;
	fs.writeFileSync(tmp, JSON.stringify(cache));
	fs.renameSync(tmp, path);
}

export function isMetadataCacheValid(
	cache: MetadataCache | null,
	configHash: string,
	now: () => number,
): boolean {
	if (!cache) return false;
	if (cache.configHash !== configHash) return false;
	return hasAnyFreshEntry(cache.servers, now());
}

export function isServerCacheFresh(
	entry: ServerCacheEntry | undefined,
	now: number,
): boolean {
	if (!entry) return false;
	return now - entry.savedAt < METADATA_CACHE_TTL_MS;
}

export function invalidateServer(cache: MetadataCache, server: string): MetadataCache {
	const { [server]: _, ...rest } = cache.servers;
	return { ...cache, servers: rest };
}

function hasAnyFreshEntry(
	servers: Record<string, ServerCacheEntry>,
	now: number,
): boolean {
	for (const entry of Object.values(servers)) {
		if (isServerCacheFresh(entry, now)) return true;
	}
	return Object.keys(servers).length === 0;
}
