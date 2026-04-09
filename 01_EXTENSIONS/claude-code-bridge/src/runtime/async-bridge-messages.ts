const seenAsyncBridgeMessages = new Set<string>();
const seenAsyncBridgeMessageOrder: string[] = [];
const MAX_SEEN_ASYNC_BRIDGE_MESSAGES = 512;

export function filterFreshAsyncBridgeMessages(messages: any[]) {
	const fresh: any[] = [];
	const nextKeys: string[] = [];
	for (const message of messages) {
		if (message?.role === "custom" && message?.customType === "claude-bridge-async") {
			const key = messageKey(message);
			if (seenAsyncBridgeMessages.has(key)) continue;
			nextKeys.push(key);
		}
		fresh.push(message);
	}
	for (const key of nextKeys) rememberAsyncBridgeMessage(key);
	return fresh;
}

export function clearAsyncBridgeMessages() {
	seenAsyncBridgeMessages.clear();
	seenAsyncBridgeMessageOrder.length = 0;
}

function rememberAsyncBridgeMessage(key: string) {
	if (seenAsyncBridgeMessages.has(key)) return;
	seenAsyncBridgeMessages.add(key);
	seenAsyncBridgeMessageOrder.push(key);
	while (seenAsyncBridgeMessageOrder.length > MAX_SEEN_ASYNC_BRIDGE_MESSAGES) {
		const oldest = seenAsyncBridgeMessageOrder.shift();
		if (oldest) seenAsyncBridgeMessages.delete(oldest);
	}
}

function messageKey(message: any) {
	const bridgeMessageId = typeof message?.details?.bridgeMessageId === "string" ? message.details.bridgeMessageId : undefined;
	if (bridgeMessageId) return bridgeMessageId;
	const contentKey = typeof message?.content === "string" ? message.content : JSON.stringify(message?.content ?? "");
	return `${Number(message?.timestamp) || 0}:${contentKey}`;
}
