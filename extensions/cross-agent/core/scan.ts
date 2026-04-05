import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { parseFrontmatter } from "./frontmatter.js";
import type { Discovered } from "./types.js";

function firstNonEmptyLine(body: string): string {
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (trimmed) return trimmed;
  }
  return "";
}

export function scanCommands(dir: string): Discovered[] {
  if (!existsSync(dir)) return [];
  const items: Discovered[] = [];
  try {
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".md")) continue;
      const raw = readFileSync(join(dir, file), "utf-8");
      const { description, body } = parseFrontmatter(raw);
      items.push({
        name: basename(file, ".md"),
        description: description || firstNonEmptyLine(body),
        content: body,
      });
    }
  } catch {
    return items;
  }
  return items;
}

export function scanSkills(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const names: string[] = [];
  try {
    for (const entry of readdirSync(dir)) {
      const skillFile = join(dir, entry, "SKILL.md");
      const flatFile = join(dir, entry);
      if (existsSync(skillFile) && statSync(skillFile).isFile()) {
        names.push(entry);
      } else if (entry.endsWith(".md") && statSync(flatFile).isFile()) {
        names.push(basename(entry, ".md"));
      }
    }
  } catch {
    return names;
  }
  return names;
}

export function scanAgents(dir: string): Discovered[] {
  if (!existsSync(dir)) return [];
  const items: Discovered[] = [];
  try {
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".md")) continue;
      const raw = readFileSync(join(dir, file), "utf-8");
      const { fields } = parseFrontmatter(raw);
      items.push({
        name: fields.name ?? basename(file, ".md"),
        description: fields.description ?? "",
        content: raw,
      });
    }
  } catch {
    return items;
  }
  return items;
}
