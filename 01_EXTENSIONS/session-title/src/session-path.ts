import * as os from "node:os";
import * as path from "node:path";

export const SUBAGENT_SESSION_DIR = path.join(os.homedir(), ".pi", "agent", "sessions", "subagents");

export function isSubagentSessionPath(sessionFilePath: string | undefined): boolean {
	if (!sessionFilePath) return false;
	return (
		sessionFilePath.startsWith(`${SUBAGENT_SESSION_DIR}${path.sep}`) ||
			sessionFilePath.startsWith(`${SUBAGENT_SESSION_DIR}/`)
	);
}

export function extractSessionFilePath(sessionManager: unknown): string | undefined {
	try {
		if (!sessionManager || typeof sessionManager !== "object" || !("getSessionFile" in sessionManager)) return undefined;
		const getSessionFile = (sessionManager as Record<string, unknown>).getSessionFile;
		if (typeof getSessionFile !== "function") return undefined;
		const sessionFilePath = String(getSessionFile() ?? "")
			.replace(/[\r\n\t]+/gu, "")
			.trim();
		return sessionFilePath || undefined;
	} catch {
		return undefined;
	}
}
