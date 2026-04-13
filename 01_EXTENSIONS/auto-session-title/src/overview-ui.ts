import { ensureOverviewOverlay, clearOverlayState } from "./overlay-state.js";
import { clearOverviewStatus, syncOverviewStatus } from "./overview-status.js";
import type { OverviewContext, SessionOverview } from "./overview-types.js";

export function syncOverviewUi(ctx: OverviewContext, overview?: SessionOverview, fallbackTitle?: string): void {
	if (!ctx.hasUI) return;
	if (syncOverviewStatus(ctx, overview, fallbackTitle)) {
		clearOverlayState();
		return;
	}
	if (!overview && !fallbackTitle) {
		clearOverlayState();
		return;
	}
	ensureOverviewOverlay(ctx, overview, fallbackTitle);
}

export function clearOverviewDisplay(ctx?: OverviewContext): void {
	clearOverviewStatus(ctx);
	clearOverlayState();
}
