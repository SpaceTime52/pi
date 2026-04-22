import { normalizeTitle } from "./title-format.js";

function sanitizeRequestText(text: string): string {
	return text
		.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gu, "$1")
		.replace(/https?:\/\/\S+/gu, " ")
		.replace(/`([^`]+)`/gu, "$1")
		.replace(/[>#*_~]+/gu, " ")
		.replace(/\s+/gu, " ")
		.trim();
}

function stripRequestFraming(text: string): string {
	return text
		.replace(/^(docs|documentation|readme)\s+/iu, "")
		.replace(/^(please|can you|could you|would you|help me|i need you to)\s+/iu, "")
		.replace(/^(이거\s*참고해서|이거|좀|혹시)\s+/u, "")
		.replace(/\s*(작업해줘|구현해줘|만들어줘|해주세요|해줘|부탁해|부탁합니다)$/u, "")
		.trim();
}

export function buildFallbackTitle(userPrompt: string): string {
	const cleaned = sanitizeRequestText(userPrompt);
	if (!cleaned) return "";
	const parts = cleaned.split(/[\n\r]+|(?<=[.!?。！？])\s+/u).map((part) => stripRequestFraming(part));
	const candidate = parts.find((part) => part.length >= 4) ?? stripRequestFraming(cleaned);
	return normalizeTitle(candidate);
}
