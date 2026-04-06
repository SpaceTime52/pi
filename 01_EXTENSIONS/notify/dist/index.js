import { notify } from "./notify.js";
export default function (pi) {
    pi.on("agent_end", async () => {
        notify("Pi", "Ready for input");
    });
}
