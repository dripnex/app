/**
 * Wikilink Parsing
 *
 * Pure domain logic for extracting wikilinks from markdown content.
 * No dependencies on storage, UI, or external libraries.
 */

import type { WikilinkRef } from './types.js';

/** Pattern for matching wikilinks: [[target]] or [[target|display]] */
// Exclude [ ] | from target to avoid matching nested/unclosed brackets
const WIKILINK_PATTERN = /\[\[([^[\]|]+)(?:\|([^\]]+))?\]\]/g;

/**
 * Extract all wikilinks from markdown content.
 *
 * Supports both simple [[Target]] and aliased [[Target|display text]] formats.
 * Returns unique targets only (deduplicated).
 *
 * @param content - Markdown content to parse
 * @returns Array of unique wikilink references
 *
 * @example
 * extractWikilinks("See [[Note A]] and [[Note B|my note]]")
 * // Returns: [{ target: "Note A" }, { target: "Note B", display: "my note" }]
 */
export function extractWikilinks(content: string): WikilinkRef[] {
  const seen = new Set<string>();
  const links: WikilinkRef[] = [];
  let match: RegExpExecArray | null;

  while ((match = WIKILINK_PATTERN.exec(content)) !== null) {
    const target = match[1]?.trim();
    if (!target) continue;

    // Deduplicate by target
    if (seen.has(target.toLowerCase())) continue;
    seen.add(target.toLowerCase());

    const display = match[2]?.trim();
    links.push(display ? { target, display } : { target });
  }

  return links;
}

/**
 * Extract just the target strings from content (simpler API).
 *
 * @param content - Markdown content to parse
 * @returns Array of unique target strings
 */
export function extractWikilinkTargets(content: string): string[] {
  return extractWikilinks(content).map(link => link.target);
}
