import { beforeEach, describe, expect, it } from "vitest";
import { ENTRY_TYPE, STYLE_PROMPT, STYLE_SECTION } from "../src/constants.js";
import { onBeforeAgentStart, onRestore } from "../src/handlers.js";
import { resetState } from "../src/state.js";

describe("handlers", () => {
	beforeEach(() => {
		resetState();
	});

	it("restores persisted state from the current branch", async () => {
		const handler = onRestore();
		await handler({}, {
			sessionManager: {
				getBranch: () => [{ type: "custom", customType: ENTRY_TYPE, data: { enabled: false } }],
			},
		});

		const beforeAgentStart = onBeforeAgentStart();
		await expect(beforeAgentStart({ systemPrompt: "BASE" })).resolves.toBeUndefined();
	});

	it("appends terse instructions when enabled", async () => {
		const beforeAgentStart = onBeforeAgentStart();
		await expect(beforeAgentStart({ systemPrompt: "BASE" })).resolves.toEqual({
			systemPrompt: `BASE\n\n${STYLE_SECTION}\n${STYLE_PROMPT}`,
		});
	});
});
