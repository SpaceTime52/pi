import { getState } from "./state.js";
import { formatWidgetLines } from "./format.js";
export function buildWidgetLines() {
    return formatWidgetLines(getState());
}
