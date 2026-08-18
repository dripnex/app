/**
 * Heading Utilities
 *
 * Delegates to the shared fence-aware scan.
 */

import { headingToSlug, scanMarkdown } from '@dripnex/markdown';

export { headingToSlug };

/** Represents a heading extracted from markdown */
export interface Heading {
  /** The heading text (without # prefix) */
  text: string;
  /** Heading level (1-6) */
  level: number;
  /** Slug for URL anchor (e.g., "my-heading") */
  slug: string;
}

/**
 * Extract all headings from markdown content.
 *
 * @example
 * extractHeadings("# Title\n\n## Section One\n\nText\n\n### Sub-section")
 * // Returns: [
 * //   { text: "Title", level: 1, slug: "title" },
 * //   { text: "Section One", level: 2, slug: "section-one" },
 * //   { text: "Sub-section", level: 3, slug: "sub-section" }
 * // ]
 */
export function extractHeadings(content: string): Heading[] {
  return scanMarkdown(content).headings.map(({ text, level, slug }) => ({
    text,
    level,
    slug,
  }));
}

/**
 * Extract just the heading text strings from content.
 *
 * @param content - Markdown content to parse
 * @returns Array of heading text strings
 */
export function extractHeadingTexts(content: string): string[] {
  return extractHeadings(content).map(h => h.text);
}

/**
 * Find a heading in content that matches a given anchor/slug.
 * Tries exact match first, then slug match.
 *
 * @param content - Markdown content to search
 * @param anchor - Anchor text or slug to find
 * @returns Matching heading or undefined
 */
export function findHeadingByAnchor(content: string, anchor: string): Heading | undefined {
  const headings = extractHeadings(content);
  const normalizedAnchor = anchor.toLowerCase().trim();

  // Try exact text match first (case-insensitive)
  const exactMatch = headings.find(h => h.text.toLowerCase() === normalizedAnchor);
  if (exactMatch) return exactMatch;

  // Try slug match
  const slugMatch = headings.find(h => h.slug === headingToSlug(normalizedAnchor));
  if (slugMatch) return slugMatch;

  // Try partial match (anchor is contained in heading)
  return headings.find(
    h =>
      h.text.toLowerCase().includes(normalizedAnchor) ||
      h.slug.includes(headingToSlug(normalizedAnchor))
  );
}
