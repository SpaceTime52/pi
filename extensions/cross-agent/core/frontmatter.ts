import type { Frontmatter } from "./types.js";

export function parseFrontmatter(raw: string): Frontmatter {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!match) return { description: "", body: raw, fields: {} };

  const front = match[1] ?? "";
  const body = match[2] ?? "";
  const fields: Record<string, string> = {};
  for (const line of front.split("\n")) {
    const idx = line.indexOf(":");
    if (idx > 0) {
      fields[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
  }
  return { description: fields.description ?? "", body, fields };
}

export function expandArgs(template: string, args: string): string {
  const parts = args.split(/\s+/).filter(Boolean);
  let result = template.replace(/\$ARGUMENTS|\$@/g, args);
  for (let i = 0; i < parts.length; i++) {
    const value = parts[i];
    if (value === undefined) continue;
    result = result.replaceAll(`$${i + 1}`, value);
  }
  return result;
}
