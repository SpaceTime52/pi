import { SERVER_NAME_SANITIZE_RE, OAUTH_TOKEN_DIR } from "./constants.js";

export interface OAuthTokens {
	access_token: string;
	token_type: string;
	refresh_token?: string;
	expiresAt?: number;
}

interface BearerOpts {
	bearerToken?: string;
	bearerTokenEnv?: string;
}

interface OAuthFsOps {
	existsSync(p: string): boolean;
	readFileSync(p: string): string;
}

export function resolveBearer(opts: BearerOpts, env: Record<string, string | undefined>): string | undefined {
	if (opts.bearerToken) return opts.bearerToken;
	if (opts.bearerTokenEnv) return env[opts.bearerTokenEnv] ?? undefined;
	return undefined;
}

export function buildAuthHeader(token: string | undefined): Record<string, string> {
	if (!token) return {};
	return { Authorization: `Bearer ${token}` };
}

function isRecord(v: unknown): v is Record<string, unknown> {
	return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseTokenObj(obj: Record<string, unknown>): OAuthTokens | null {
	if (typeof obj.access_token !== "string") return null;
	let expiresAt: number | undefined;
	if (typeof obj.expiresAt === "number") {
		expiresAt = obj.expiresAt;
	} else if (typeof obj.expires_in === "number" && typeof obj.savedAt === "number") {
		expiresAt = obj.savedAt + obj.expires_in * 1000;
	}
	return {
		access_token: obj.access_token,
		token_type: typeof obj.token_type === "string" ? obj.token_type : "bearer",
		refresh_token: typeof obj.refresh_token === "string" ? obj.refresh_token : undefined,
		expiresAt,
	};
}

export function loadOAuthTokens(path: string, fs: OAuthFsOps): OAuthTokens | null {
	if (!fs.existsSync(path)) return null;
	try {
		const raw = fs.readFileSync(path);
		const parsed: unknown = JSON.parse(raw);
		if (!isRecord(parsed)) return null;
		return parseTokenObj(parsed);
	} catch {
		return null;
	}
}

export function isOAuthTokenValid(tokens: OAuthTokens | null, now: () => number): boolean {
	if (!tokens) return false;
	if (tokens.expiresAt !== undefined && now() > tokens.expiresAt) return false;
	return true;
}

export function oauthTokenPath(serverName: string): string {
	const safe = serverName.replace(SERVER_NAME_SANITIZE_RE, "");
	return `${OAUTH_TOKEN_DIR}/${safe}/tokens.json`;
}
