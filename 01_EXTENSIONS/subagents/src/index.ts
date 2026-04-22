import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import registerSubagents from "@tintinweb/pi-subagents/dist/index.js";

export default function (pi: ExtensionAPI) {
	return registerSubagents(arguments[0]);
}
