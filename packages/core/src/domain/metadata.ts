/**
 * Note metadata - derived from markdown content
 * These values are computed, not stored separately
 */

import { scanMarkdown } from '@dripnex/markdown';
import { parseNoteFrontmatter } from './frontmatter.js';
import { createTag, type Tag, type Timestamp } from './types.js';

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

  /** GFM task items in the body */
  readonly taskCount: number;

  /** Checked GFM task items in the body */
  readonly checkedTaskCount: number;

  /** Archive timestamp (null if not archived) */
  readonly archivedAt: Timestamp | null;
}

export function isPlaceholderTitle(title: string): boolean {
  return title.trim().length === 0 || title.trim().toLowerCase() === 'untitled';
}

/** Extracts the title from markdown content */
export function extractTitle(content: string, fallback: string = 'Untitled'): string {
  // Only the first non-empty line of the body. Frontmatter is not the title.
  const body = parseNoteFrontmatter(content).body;
  const firstLine = body.split(/\r?\n/).find(line => line.trim().length > 0);
  if (!firstLine) return fallback;

  const heading = firstLine.match(/^#{1,6}\s+(.+)$/);
  const raw = (heading?.[1] ?? firstLine).trim();
  return raw.slice(0, 100) || fallback;
}

/** Extracts tags from markdown content */
export function extractTags(content: string): Tag[] {
  return scanMarkdown(parseNoteFrontmatter(content).body).tags.map(createTag);
}

/** Counts words in content */
export function countWords(content: string): number {
  const text = parseNoteFrontmatter(content)
    .body.replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/`[^`]+`/g, '') // Remove inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Extract link text
    .replace(/[#*_~`]/g, ''); // Remove markdown chars

  const words = text.split(/\s+/).filter(word => word.length > 0);
  return words.length;
}

/** GFM task totals — same fence-aware walk as tags. */
export function extractTasks(content: string): { total: number; completed: number } {
  return scanMarkdown(parseNoteFrontmatter(content).body).tasks;
}
