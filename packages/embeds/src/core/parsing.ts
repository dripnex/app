/**
 * Embed Parsing
 *
 * Delegates to the shared fence-aware scan.
 */

import { scanMarkdown } from '@dripnex/markdown';
import type { EmbedRef } from './types.js';

/**
 * Extract all embed references from markdown content.
 *
 * @example
 * extractEmbeds('Check ![[diagram.png]] and ![[spec.pdf|PDF Spec]]')
 * // Returns: [
 * //   { target: 'diagram.png' },
 * //   { target: 'spec.pdf', display: 'PDF Spec' }
 * // ]
 */
export function extractEmbeds(content: string): EmbedRef[] {
  return scanMarkdown(content).embeds;
}

/**
 * Extract unique embed targets (filenames) from markdown content.
 * Case-preserved, deduplicated case-insensitive.
 */
export function extractEmbedTargets(content: string): string[] {
  return scanMarkdown(content).embedTargets;
}
