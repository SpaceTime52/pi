import { normalizeTitle } from "./title-format.js";

function sanitizeRequestText(text: string): string {
	return text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gu, "$1").replace(/https?:\/\/\S+/gu, " ").replace(/`([^`]+)`/gu, "$1").replace(/[>#*_~]+/gu, " ").replace(/\s+/gu, " ").trim();
}

function stripRequestFraming(text: string): string {
	return text.replace(/^(docs|documentation|readme)\s+/iu, "").replace(/^(please|can you|could you|would you|help me|i need you to)\s+/iu, "").replace(/^(이거\s*참고해서|이거|좀|혹시)\s+/u, "").replace(/\s*(작업해줘|구현해줘|만들어줘|해주세요|해줘|부탁해|부탁합니다)$/u, "").trim();
}

function stripLogistics(text: string): string {
	return text.replace(/(?:^|\s)(다 만들고\s*)?(커밋|푸시|commit|push|typecheck|test|build).*/iu, "").replace(/(?:^|\s)(extensions?에 만들면 됨|extensions?에 넣어줘).*/iu, "").trim();
}

function summarizeKnownTask(text: string): string {
	const korean = /[가-힣]/u.test(text);
	const suffix = /\bextensions?\b/iu.test(text) || /extensions?에/u.test(text) ? " extension" : "";
	const hasSessionTitle = /(session (name|title)|세션 (이름|제목))/iu.test(text);
	const hasTerminalTitle = /(terminal title|터미널 제목)/iu.test(text);
	if (hasSessionTitle && hasTerminalTitle) {
		if (korean) return `세션/터미널 제목 자동 설정${suffix}`;
		return `session/terminal title auto sync${suffix}`;
	}
	if (hasSessionTitle) {
		if (korean) return `세션 제목 자동 설정${suffix}`;
		return `session title auto naming${suffix}`;
	}
	if (hasTerminalTitle) {
		if (korean) return `터미널 제목 자동 설정${suffix}`;
		return `terminal title sync${suffix}`;
	}
	return "";
}

export function buildFallbackTitle(userPrompt: string): string {
	const cleaned = stripLogistics(sanitizeRequestText(userPrompt));
	if (!cleaned) return "";
	const summarized = summarizeKnownTask(cleaned);
	if (summarized) return normalizeTitle(summarized);
	const parts = cleaned.split(/[\n\r]+|(?<=[.!?。！？])\s+/u).map((part) => stripRequestFraming(part)).filter(Boolean);
	const candidate = parts.find((part) => part.length >= 4) ?? stripRequestFraming(cleaned);
	return normalizeTitle(candidate);
}
