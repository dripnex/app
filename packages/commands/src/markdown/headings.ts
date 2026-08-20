import { scanMarkdown } from '@dripnex/markdown';

export interface Heading {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  /** 1-indexed source line. */
  line: number;
}

/**
 * ATX headings (`#`–`######`) outside fenced code.
 */
export function extractHeadings(markdown: string): Heading[] {
  return scanMarkdown(markdown).headings.map(({ level, text, line }) => ({
    level,
    text,
    line,
  }));
}
