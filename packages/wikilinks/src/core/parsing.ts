/**
 * Wikilink Parsing
 *
 * Delegates to the shared fence-aware scan.
 */

import { scanMarkdown } from '@dripnex/markdown';
import type { WikilinkRef } from './types.js';

/**
 * Extract unique wikilinks from markdown content.
 *
 * @example
 * extractWikilinks("See [[Note A]] and [[Note B#Section|my note]]")
 * // Returns: [
 * //   { target: "Note A" },
 * //   { target: "Note B", anchor: "Section", display: "my note" }
 * // ]
 */
export function extractWikilinks(content: string): WikilinkRef[] {
  return scanMarkdown(content).wikilinks;
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
