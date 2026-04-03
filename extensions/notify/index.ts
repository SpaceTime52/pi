import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { notify } from "./core/notify.js";

export default function (pi: ExtensionAPI) {
  pi.on("agent_end", async () => {
    notify("pi", "작업 완료");
  });
}
