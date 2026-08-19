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
  return extractWikilinks(content)
    .map(link => link.target)
    .filter(Boolean);
}

const TOKEN = /\[\[([^\]|#]*)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g;

/** Wikilink whose `[[...]]` span contains `index` (inclusive). */
export function parseWikilinkAt(text: string, index: number): WikilinkRef | null {
  TOKEN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TOKEN.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (index < start || index > end) continue;
    const target = match[1]?.trim() ?? '';
    const anchor = match[2]?.trim();
    const display = match[3]?.trim();
    if (!target && !anchor) return null;
    const ref: WikilinkRef = { target };
    if (anchor) ref.anchor = anchor;
    if (display) ref.display = display;
    return ref;
  }
  return null;
}
