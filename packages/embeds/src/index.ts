/**
 * @readied/embeds
 *
 * Embed system for Readied.
 * Supports ![[filename]] syntax for embedding images, videos, audio, and PDFs.
 *
 * USAGE:
 *   import { remarkEmbed, extractEmbeds } from '@readied/embeds';
 *
 *   // In remark plugins:
 *   remarkPlugins={[remarkGfm, remarkWikilink, remarkEmbed]}
 *
 *   // For parsing:
 *   const embeds = extractEmbeds(content);
 */

// Core - types
export type { EmbedRef, EmbedType } from './core/types.js';
export { getEmbedType } from './core/types.js';

// Core - parsing (pure, no deps)
export { extractEmbeds, extractEmbedTargets } from './core/parsing.js';

// Adapters
export { remarkEmbed } from './adapters/remark/remark-embed.js';
