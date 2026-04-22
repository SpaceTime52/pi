import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import * as path from "node:path";

export function getProjectName(ctx: ExtensionContext) {
	return path.basename(ctx.cwd) || ctx.cwd;
}
