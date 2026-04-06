import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { notify } from "./notify.js";

export default function (pi: ExtensionAPI) {
	pi.on("agent_end", async () => {
		notify("Pi", "Ready for input");
	});
}
