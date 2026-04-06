import { getState } from "./state.js";
import { formatWidgetLines } from "./format.js";

export function buildWidgetLines(): string[] {
	return formatWidgetLines(getState());
}
