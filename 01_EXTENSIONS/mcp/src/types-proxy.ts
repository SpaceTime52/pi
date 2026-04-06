export type ProxyAction = "call" | "list" | "describe" | "search" | "status" | "connect";

export interface ProxyParams {
	action: ProxyAction;
	tool?: string;
	args?: Record<string, unknown>;
	server?: string;
	query?: string;
}

export interface ProxyToolResult {
	content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
	details?: Record<string, unknown>;
}

export interface ProxyErrorResult {
	code: string;
	message: string;
	hint?: string;
	server?: string;
	tool?: string;
}
