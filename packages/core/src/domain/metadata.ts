/**
 * Note metadata - derived from markdown content
 * These values are computed, not stored separately
 */

import type { Tag, Timestamp } from './types.js';

/** Metadata derived from a note's content */
export interface NoteMetadata {
  /** Title extracted from first H1 or filename */
  readonly title: string;

  /** Creation timestamp */
  readonly createdAt: Timestamp;

  /** Last modification timestamp */
  readonly updatedAt: Timestamp;

  /** Tags extracted from content (#tag format) */
  readonly tags: readonly Tag[];

  /** Word count of the content */
  readonly wordCount: number;

  /** Archive timestamp (null if not archived) */
  readonly archivedAt: Timestamp | null;
}

/** Extracts the title from markdown content */
export function extractTitle(content: string, fallback: string = 'Untitled'): string {
  // Match first H1 heading: # Title
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match?.[1]) {
    return h1Match[1].trim();
  }

  // Fallback to first non-empty line
  const firstLine = content.split('\n').find(line => line.trim().length > 0);
  if (firstLine) {
    // Remove any markdown formatting
    return (
      firstLine
        .replace(/^#+\s*/, '')
        .trim()
        .slice(0, 100) || fallback
    );
  }

  return fallback;
}

/** Extracts tags from markdown content */
export function extractTags(content: string): Tag[] {
  // Match #tag patterns (not inside code blocks)
  const tagPattern = /(?:^|\s)#([a-zA-Z][a-zA-Z0-9_-]*)/g;
  const tags = new Set<string>();

  let match;
  while ((match = tagPattern.exec(content)) !== null) {
    if (match[1]) {
      tags.add(match[1].toLowerCase());
    }
  }

  return Array.from(tags) as Tag[];
}

/** Counts words in content */
export function countWords(content: string): number {
  const text = content
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/`[^`]+`/g, '') // Remove inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Extract link text
    .replace(/[#*_~`]/g, ''); // Remove markdown chars

  const words = text.split(/\s+/).filter(word => word.length > 0);
  return words.length;
}
