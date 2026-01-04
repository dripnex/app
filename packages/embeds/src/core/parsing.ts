/**
 * Embed Parsing
 *
 * Pure functions to extract embed references from markdown.
 */

import type { EmbedRef } from './types.js';

/**
 * Regex to match embed syntax: ![[target]] or ![[target|display]]
 * - Must start with ![[
 * - Target cannot contain [ or ]
 * - Optional |display text
 * - Must end with ]]
 */
const EMBED_REGEX = /!\[\[([^[\]|]+)(?:\|([^\]]+))?\]\]/g;

/**
 * Extract all embed references from markdown content.
 *
 * @param content - Markdown text
 * @returns Array of embed references
 *
 * @example
 * extractEmbeds('Check ![[diagram.png]] and ![[spec.pdf|PDF Spec]]')
 * // Returns: [
 * //   { target: 'diagram.png' },
 * //   { target: 'spec.pdf', display: 'PDF Spec' }
 * // ]
 */
export function extractEmbeds(content: string): EmbedRef[] {
  const embeds: EmbedRef[] = [];
  let match: RegExpExecArray | null;

  // Reset regex state
  EMBED_REGEX.lastIndex = 0;

  while ((match = EMBED_REGEX.exec(content)) !== null) {
    const rawTarget = match[1];
    if (!rawTarget) continue;

    const target = rawTarget.trim();
    const display = match[2]?.trim();

    if (target) {
      embeds.push(display ? { target, display } : { target });
    }
  }

  return embeds;
}

/**
 * Extract unique embed targets (filenames) from markdown content.
 *
 * @param content - Markdown text
 * @returns Array of unique filenames (case-preserved, deduplicated case-insensitive)
 */
export function extractEmbedTargets(content: string): string[] {
  const embeds = extractEmbeds(content);
  const seen = new Set<string>();
  const targets: string[] = [];

  for (const embed of embeds) {
    const lower = embed.target.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      targets.push(embed.target);
    }
  }

  return targets;
}
