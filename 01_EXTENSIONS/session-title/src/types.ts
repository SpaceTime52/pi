import type { ExtensionContext } from "@mariozechner/pi-coding-agent";

export type SessionLifecycleEvent = object;
export type BeforeAgentStartEvent = { prompt: string };
export type SessionHandler = (event: SessionLifecycleEvent, ctx: ExtensionContext) => void | Promise<void>;
export type BeforeAgentStartHandler = (event: BeforeAgentStartEvent, ctx: ExtensionContext) => void | Promise<void>;

export type SessionTitleApi = {
	getSessionName: () => string | undefined;
	setSessionName: (name: string) => void;
	on(name: "session_start" | "session_tree" | "agent_end" | "session_shutdown", handler: SessionHandler): void;
	on(name: "before_agent_start", handler: BeforeAgentStartHandler): void;
};
