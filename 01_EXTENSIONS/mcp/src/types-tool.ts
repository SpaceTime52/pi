export interface ToolMetadata {
	name: string;
	originalName: string;
	serverName: string;
	description: string;
	inputSchema?: Record<string, unknown>;
	resourceUri?: string;
}

export interface DirectToolSpec {
	serverName: string;
	originalName: string;
	prefixedName: string;
	description: string;
	inputSchema?: Record<string, unknown>;
	resourceUri?: string;
}

export interface ToolDef {
	name: string;
	label: string;
	description: string;
	promptSnippet?: string;
	promptGuidelines?: string[];
	parameters: unknown;
	execute: ToolExecuteFn;
}

export type ToolExecuteFn = (
	toolCallId: string,
	params: Record<string, unknown>,
	signal: unknown,
	onUpdate: unknown,
	ctx: unknown,
) => Promise<ToolResult>;

export interface ToolResult {
	content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
	details?: Record<string, unknown>;
}
