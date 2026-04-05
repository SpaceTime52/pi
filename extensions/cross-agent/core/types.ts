export interface Discovered {
  name: string;
  description: string;
  content: string;
}

export interface SourceGroup {
  source: string;
  commands: Discovered[];
  skills: string[];
  agents: Discovered[];
}

export interface Frontmatter {
  description: string;
  body: string;
  fields: Record<string, string>;
}
