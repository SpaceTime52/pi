import { afterEach, describe, expect, it } from "vitest";
import type { BridgeState } from "../src/core/types.js";
import { buildDynamicContext, clearSessionState, filterFreshAsyncBridgeMessages, queueAdditionalContext } from "../src/runtime/store.js";

function makeState(): BridgeState {
	return {
		cwd: "/repo",
		projectRoot: "/repo",
		enabled: true,
		instructionFiles: [],
		settingsFiles: [],
		instructions: [],
		eagerLoads: [],
		unconditionalPromptText: "",
		conditionalRules: [],
		activeConditionalRuleIds: new Set<string>(),
		hooksByEvent: new Map(),
		mergedEnv: {},
		fileWatchBasenames: [],
		disableAllHooks: false,
		hasRepoScopedHooks: false,
		warnings: [],
	};
}

describe("claude bridge context filtering", () => {
	afterEach(() => clearSessionState());

	it("keeps async bridge messages only for their first model turn", () => {
		const asyncMessage = { role: "custom", customType: "claude-bridge-async", content: "late hook context", display: false, timestamp: 123 };
		const userMessage = { role: "user", content: "hello", timestamp: 100 };
		expect(filterFreshAsyncBridgeMessages([userMessage, asyncMessage])).toEqual([userMessage, asyncMessage]);
		expect(filterFreshAsyncBridgeMessages([userMessage, asyncMessage])).toEqual([userMessage]);
	});

	it("does not filter unrelated custom messages", () => {
		const otherCustom = { role: "custom", customType: "other-extension", content: "keep me", display: false, timestamp: 1 };
		expect(filterFreshAsyncBridgeMessages([otherCustom])).toEqual([otherCustom]);
		expect(filterFreshAsyncBridgeMessages([otherCustom])).toEqual([otherCustom]);
	});

	it("distinguishes async bridge messages by explicit bridgeMessageId", () => {
		const first = { role: "custom", customType: "claude-bridge-async", content: "same", display: false, details: { bridgeMessageId: "a" } };
		const second = { role: "custom", customType: "claude-bridge-async", content: "same", display: false, details: { bridgeMessageId: "b" } };
		expect(filterFreshAsyncBridgeMessages([first, second])).toEqual([first, second]);
		expect(filterFreshAsyncBridgeMessages([first, second])).toEqual([]);
	});

	it("bounds async bridge dedupe memory by evicting old message keys", () => {
		const makeMessage = (index: number) => ({ role: "custom", customType: "claude-bridge-async", content: `late hook context ${index}`, display: false, details: { bridgeMessageId: `message-${index}` } });
		const first = makeMessage(0);
		expect(filterFreshAsyncBridgeMessages([first])).toEqual([first]);
		expect(filterFreshAsyncBridgeMessages([first])).toEqual([]);
		for (let i = 1; i <= 512; i++) expect(filterFreshAsyncBridgeMessages([makeMessage(i)])).toHaveLength(1);
		expect(filterFreshAsyncBridgeMessages([first])).toEqual([first]);
	});

	it("injects queued hook context only once", () => {
		queueAdditionalContext(["async hook follow-up"]);
		expect(buildDynamicContext(makeState())).toContain("async hook follow-up");
		expect(buildDynamicContext(makeState())).toBeUndefined();
	});
});
