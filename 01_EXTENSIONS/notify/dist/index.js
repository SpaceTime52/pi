// src/notify.ts
function sanitizeNotificationText(text) {
  return text.replace(/[\r\n\t]+/g, " ").replace(/[\x00-\x1f\x7f;]+/g, " ").replace(/ +/g, " ").trim();
}
function buildReadyNotification(sessionName) {
  return {
    title: sessionName ? `Pi \xB7 ${sessionName}` : "Pi",
    body: "Ready for input"
  };
}
function notifyOSC777(title, body, write) {
  write(`\x1B]777;notify;${title};${body}\x07`);
}
function notifyOSC99(title, body, write) {
  write(`\x1B]99;i=1:d=0;${title}\x1B\\`);
  write(`\x1B]99;i=1:p=body;${body}\x1B\\`);
}
function notify(title, body, write = (s) => process.stdout.write(s)) {
  const safeTitle = sanitizeNotificationText(title) || "Pi";
  const safeBody = sanitizeNotificationText(body);
  if (process.env.KITTY_WINDOW_ID) {
    notifyOSC99(safeTitle, safeBody, write);
  } else {
    notifyOSC777(safeTitle, safeBody, write);
  }
}

// src/index.ts
function index_default(pi) {
  pi.on("agent_end", async (_event, ctx) => {
    const message = buildReadyNotification(ctx.sessionManager.getSessionName());
    notify(message.title, message.body);
  });
}
export {
  index_default as default
};
