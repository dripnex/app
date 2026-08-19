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

/** Wikilink whose `[[...]]` span contains `index` (inclusive). Linear, no regex. */
export function parseWikilinkAt(text: string, index: number): WikilinkRef | null {
  if (index < 0 || index > text.length) return null;
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf('[[', i);
    if (open === -1) return null;
    const close = text.indexOf(']]', open + 2);
    if (close === -1) return null;
    const end = close + 2;
    if (index >= open && index <= end) {
      return parseWikilinkInner(text.slice(open + 2, close));
    }
    i = open + 2;
  }
  return null;
}

function parseWikilinkInner(inner: string): WikilinkRef | null {
  let i = 0;
  while (i < inner.length) {
    const c = inner[i];
    if (c === '#' || c === '|' || c === ']') break;
    i += 1;
  }
  const target = inner.slice(0, i).trim();
  let rest = inner.slice(i);

  let anchor: string | undefined;
  if (rest.startsWith('#')) {
    rest = rest.slice(1);
    i = 0;
    while (i < rest.length) {
      const c = rest[i];
      if (c === '|' || c === ']') break;
      i += 1;
    }
    if (i === 0) return null;
    anchor = rest.slice(0, i).trim();
    rest = rest.slice(i);
    if (!anchor) return null;
  }

  let display: string | undefined;
  if (rest.startsWith('|')) {
    rest = rest.slice(1);
    if (!rest) return null;
    display = rest.trim();
    rest = '';
    if (!display) return null;
  }

  if (rest) return null;
  if (!target && !anchor) return null;
  const ref: WikilinkRef = { target };
  if (anchor) ref.anchor = anchor;
  if (display) ref.display = display;
  return ref;
}
