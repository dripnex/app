/**
 * Heading Utilities
 *
 * Functions for extracting headings from markdown and generating slugs
 * for anchor navigation.
 */

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
 * @param content - Markdown content to parse
 * @returns Array of headings with text, level, and slug
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
  const headingPattern = /^(#{1,6})\s+(.+)$/gm;
  const headings: Heading[] = [];
  let match: RegExpExecArray | null;

  while ((match = headingPattern.exec(content)) !== null) {
    const level = match[1]!.length;
    const text = match[2]!.trim();

    if (text) {
      headings.push({
        text,
        level,
        slug: headingToSlug(text),
      });
    }
  }

  return headings;
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
 * Generate a URL-safe slug from heading text.
 * Matches GitHub's heading anchor generation algorithm.
 *
 * @param heading - Heading text to convert
 * @returns URL-safe slug
 *
 * @example
 * headingToSlug("Hello World!")  // "hello-world"
 * headingToSlug("API Reference") // "api-reference"
 * headingToSlug("1. Introduction") // "1-introduction"
 */
export function headingToSlug(heading: string): string {
  return (
    heading
      .toLowerCase()
      .trim()
      // Remove special characters except alphanumeric, spaces, and hyphens
      .replace(/[^\w\s-]/g, '')
      // Replace whitespace with hyphens
      .replace(/\s+/g, '-')
      // Remove consecutive hyphens
      .replace(/-+/g, '-')
      // Remove leading/trailing hyphens
      .replace(/^-|-$/g, '')
  );
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
