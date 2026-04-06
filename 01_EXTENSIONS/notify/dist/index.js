// src/notify.ts
function notifyOSC777(title, body, write) {
  write(`\x1B]777;notify;${title};${body}\x07`);
}
function notifyOSC99(title, body, write) {
  write(`\x1B]99;i=1:d=0;${title}\x1B\\`);
  write(`\x1B]99;i=1:p=body;${body}\x1B\\`);
}
function notify(title, body, write = (s) => process.stdout.write(s)) {
  if (process.env.KITTY_WINDOW_ID) {
    notifyOSC99(title, body, write);
  } else {
    notifyOSC777(title, body, write);
  }
}

// src/index.ts
function index_default(pi) {
  pi.on("agent_end", async () => {
    notify("Pi", "Ready for input");
  });
}
export {
  index_default as default
};
