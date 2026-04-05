import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { setupClaudeMcpBridge } from "./core/bridge.js";

export default async function (pi: ExtensionAPI) {
  await setupClaudeMcpBridge(pi);
}
