/**
 * @dripnex/wikilinks
 *
 * Wikilink system for Dripnex.
 * Pure domain logic - no Electron, React, or UI dependencies.
 *
 * USAGE:
 *   import { createWikilinkPlugin } from '@dripnex/wikilinks';
 *   const plugin = createWikilinkPlugin(resolver);
 *
 * The createWikilinkPlugin factory is the recommended entry point.
 * Individual exports are available for advanced use cases only.
 */

// Core - contracts and types
export type { WikilinkNote, WikilinkResolver } from './core/contracts.js';
export type { WikilinkRef } from './core/types.js';

// Core - parsing (pure, no deps)
export { extractWikilinks, extractWikilinkTargets } from './core/parsing.js';

// Core - headings (for [[Note#Heading]] support)
export type { Heading } from './core/headings.js';
export {
  extractHeadings,
  extractHeadingTexts,
  headingToSlug,
  findHeadingByAnchor,
  splitWikilinkQuery,
  filterHeadings,
} from './core/headings.js';

// Adapters (for advanced use only)
export {
  createWikilinkAutocomplete,
  createWikilinkTitle,
  setCurrentNoteId,
  currentNoteIdField,
} from './adapters/codemirror/autocomplete.js';
export { wikilinkExtension } from './adapters/codemirror/highlight.js';
export { remarkWikilink } from './adapters/remark/remark-wikilink.js';

// Factory function - RECOMMENDED ENTRY POINT
export { createWikilinkPlugin } from './plugin.js';
export type { WikilinkPlugin } from './plugin.js';
