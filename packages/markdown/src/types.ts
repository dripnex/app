export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface MarkdownHeading {
  level: HeadingLevel;
  text: string;
  /** 1-indexed source line */
  line: number;
  slug: string;
}

export interface MarkdownEmbed {
  target: string;
  display?: string;
}

export interface MarkdownWikilink {
  target: string;
  anchor?: string;
  display?: string;
}

export interface MarkdownTasks {
  total: number;
  completed: number;
}

export interface MarkdownScan {
  headings: MarkdownHeading[];
  embeds: MarkdownEmbed[];
  embedTargets: string[];
  wikilinks: MarkdownWikilink[];
  tasks: MarkdownTasks;
  /** Inline #tags, lowercase, unique, fences and inline code stripped. */
  tags: string[];
}
