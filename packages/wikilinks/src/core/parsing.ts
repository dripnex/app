/**
 * Wikilink Parsing
 *
 * Pure domain logic for extracting wikilinks from markdown content.
 * No dependencies on storage, UI, or external libraries.
 */

import type { WikilinkRef } from './types.js';

/**
 * Pattern for matching wikilinks with optional heading anchor:
 * - [[target]]
 * - [[target#heading]]
 * - [[target|display]]
 * - [[target#heading|display]]
 *
 * Groups: [1]=target, [2]=anchor (optional), [3]=display (optional)
 */
const WIKILINK_PATTERN = /\[\[([^[\]|#]+)(?:#([^[\]|]+))?(?:\|([^\]]+))?\]\]/g;

/**
 * Extract all wikilinks from markdown content.
 *
 * Supports:
 * - Simple: [[Target]]
 * - With anchor: [[Target#Heading]]
 * - Aliased: [[Target|display text]]
 * - Combined: [[Target#Heading|display text]]
 *
 * Returns unique targets only (deduplicated by target+anchor).
 *
 * @param content - Markdown content to parse
 * @returns Array of unique wikilink references
 *
 * @example
 * extractWikilinks("See [[Note A]] and [[Note B#Section|my note]]")
 * // Returns: [
 * //   { target: "Note A" },
 * //   { target: "Note B", anchor: "Section", display: "my note" }
 * // ]
 */
export function extractWikilinks(content: string): WikilinkRef[] {
  const seen = new Set<string>();
  const links: WikilinkRef[] = [];
  let match: RegExpExecArray | null;

  while ((match = WIKILINK_PATTERN.exec(content)) !== null) {
    const target = match[1]?.trim();
    if (!target) continue;

    const anchor = match[2]?.trim();
    const display = match[3]?.trim();

    // Deduplicate by target + anchor combination
    const key = `${target.toLowerCase()}#${anchor?.toLowerCase() ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const link: WikilinkRef = { target };
    if (anchor) link.anchor = anchor;
    if (display) link.display = display;
    links.push(link);
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
