export const MAIN_AGENT = "main assistant";

export type Phase = "idle" | "working" | "delegating" | "using-tool" | "done";

export type AttributionState = {
	phase: Phase;
	actor: string;
	detail?: string;
	contributors: string[];
};

export function formatActorList(actors: string[]): string {
	if (actors.length <= 2) return actors.join(", ");
	return `${actors[0]}, ${actors[1]} +${actors.length - 2}`;
}

export function getPlainStatusText(state: AttributionState): string {
	const actorText = `agent: ${state.actor}`;
	const via = state.contributors.filter((actor) => actor !== MAIN_AGENT);
	const viaText = via.length > 0 ? ` · via ${formatActorList(via)}` : "";
	const detailText = state.detail ? ` · ${state.detail}` : "";

	if (state.phase === "idle") return `${actorText} · idle${viaText}`;
	if (state.phase === "done") return `✓ ${actorText} · done${viaText}`;
	if (state.phase === "delegating") return `${actorText}${detailText || " · delegated"}`;
	if (state.phase === "using-tool") return `${actorText}${detailText}`;
	return `${actorText} · preparing`;
}
