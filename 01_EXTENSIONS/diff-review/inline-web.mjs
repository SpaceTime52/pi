import { readFileSync, writeFileSync } from "node:fs";

const distFile = new URL("./dist/index.js", import.meta.url);
const webDir = new URL("./node_modules/@ryan_nookpi/pi-extension-diff-review/web/", import.meta.url);

const templateHtml = JSON.stringify(readFileSync(new URL("index.html", webDir), "utf8"));
const appJs = JSON.stringify(readFileSync(new URL("app.js", webDir), "utf8"));

const before = `function buildReviewHtml(data) {
  const templateHtml = readFileSync2(join4(webDir, "index.html"), "utf8");
  const appJs = readFileSync2(join4(webDir, "app.js"), "utf8");
  const payload = escapeForInlineScript(JSON.stringify(data));
  return templateHtml.replace('"__INLINE_DATA__"', payload).replace("__INLINE_JS__", appJs);
}`;

const after = `var templateHtml = ${templateHtml};
var appJs = ${appJs};
function buildReviewHtml(data) {
  const payload = escapeForInlineScript(JSON.stringify(data));
  return templateHtml.replace('\"__INLINE_DATA__\"', payload).replace("__INLINE_JS__", appJs);
}`;

const source = readFileSync(distFile, "utf8");
if (!source.includes(before)) throw new Error("buildReviewHtml block not found in dist/index.js");
writeFileSync(distFile, source.replace(before, after));
