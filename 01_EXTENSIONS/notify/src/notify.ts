type Writer = (s: string) => void;

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
	if (process.env.KITTY_WINDOW_ID) {
		notifyOSC99(title, body, write);
	} else {
		notifyOSC777(title, body, write);
	}
}
