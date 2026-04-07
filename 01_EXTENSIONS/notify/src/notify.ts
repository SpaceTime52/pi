type Writer = (s: string) => void;

export function sanitizeNotificationText(text: string): string {
	return text
		.replace(/[\r\n\t]+/g, " ")
		.replace(/[\x00-\x1f\x7f;]+/g, " ")
		.replace(/ +/g, " ")
		.trim();
}

export function buildReadyNotification(sessionName?: string): { title: string; body: string } {
	return {
		title: sessionName ? `Pi · ${sessionName}` : "Pi",
		body: "Ready for input",
	};
}

function notifyOSC777(title: string, body: string, write: Writer): void {
	write(`\x1b]777;notify;${title};${body}\x07`);
}

function notifyOSC99(title: string, body: string, write: Writer): void {
	write(`\x1b]99;i=1:d=0;${title}\x1b\\`);
	write(`\x1b]99;i=1:p=body;${body}\x1b\\`);
}

export function notify(
	title: string,
	body: string,
	write: Writer = (s) => process.stdout.write(s),
): void {
	const safeTitle = sanitizeNotificationText(title) || "Pi";
	const safeBody = sanitizeNotificationText(body);
	if (process.env.KITTY_WINDOW_ID) {
		notifyOSC99(safeTitle, safeBody, write);
	} else {
		notifyOSC777(safeTitle, safeBody, write);
	}
}
