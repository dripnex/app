import { headingToSlug, scanMarkdown, type MarkdownHeading } from '@dripnex/markdown';

/** Last heading whose source line is at or above `line` (1-indexed). */
export function headingIndexAtOrBefore(
  headings: readonly { line: number }[],
  line: number
): number {
  let index = -1;
  for (let i = 0; i < headings.length; i += 1) {
    const heading = headings[i];
    if (heading && heading.line <= line) index = i;
    else break;
  }
  return index;
}

/** First heading whose text matches, else -1. */
export function headingIndexByText(
  headings: readonly { text: string }[],
  text: string | null
): number {
  if (!text) return -1;
  return headings.findIndex(heading => heading.text === text);
}

/** Resolve a URL hash or wikilink `#anchor` to a heading in `content`. */
export function findHeadingForAnchor(content: string, anchor: string): MarkdownHeading | null {
  const raw = decodeURIComponent(anchor).replace(/^#/, '').trim();
  if (!raw) return null;
  const slug = headingToSlug(raw);
  const headings = scanMarkdown(content).headings;
  return (
    headings.find(heading => headingToSlug(heading.text) === slug) ??
    headings.find(heading => heading.text.toLowerCase() === raw.toLowerCase()) ??
    null
  );
}
