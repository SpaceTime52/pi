import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { handleInput } from "./handlers.js";

export default function (pi: ExtensionAPI) {
	pi.on("input", async (event, ctx) => handleInput({ getSessionName: () => pi.getSessionName(), setSessionName: (name) => pi.setSessionName(name) }, event, ctx));
}
