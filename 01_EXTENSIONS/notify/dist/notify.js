function notifyOSC777(title, body, write) {
    write(`\x1b]777;notify;${title};${body}\x07`);
}
function notifyOSC99(title, body, write) {
    write(`\x1b]99;i=1:d=0;${title}\x1b\\`);
    write(`\x1b]99;i=1:p=body;${body}\x1b\\`);
}
export function notify(title, body, write = (s) => process.stdout.write(s)) {
    if (process.env.KITTY_WINDOW_ID) {
        notifyOSC99(title, body, write);
    }
    else {
        notifyOSC777(title, body, write);
    }
}
