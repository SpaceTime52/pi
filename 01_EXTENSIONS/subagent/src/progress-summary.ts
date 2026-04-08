import { previewText } from "./format.js";
import { isSubagentToolName } from "./tool-names.js";

export function summarizeToolActivity(toolName: string, text: string | undefined): string {
	if (!isSubagentToolName(toolName)) return `${toolName}${text ? `: ${previewText(text, 72)}` : ""}`;
	const batch = text?.match(/⏳ batch progress — (\d+) active \/ (\d+) finished \/ (\d+) total/);
	if (batch) return `${toolName}: ${batch[1]} active / ${batch[2]} finished / ${batch[3]} total`;
	const current = text?.match(/(?:^|\n)current:\s*(.+)$/m)?.[1];
	if (current) return `${toolName}: ${previewText(current, 72)}`;
	const firstLine = text?.split("\n").find(Boolean)?.replace(/^⏳\s+/, "");
	return `${toolName}${firstLine ? `: ${previewText(firstLine, 72)}` : ""}`;
}
