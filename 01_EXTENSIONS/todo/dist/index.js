import { reconstructState } from "./state.js";
import { todoTool } from "./tool.js";
export default function (pi) {
    pi.on("session_start", async (_event, ctx) => {
        reconstructState(ctx.sessionManager.getBranch());
    });
    pi.on("session_tree", async (_event, ctx) => {
        reconstructState(ctx.sessionManager.getBranch());
    });
    pi.registerTool(todoTool);
}
