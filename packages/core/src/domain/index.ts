/**
 * Domain exports
 */

export * from './types.js';
export * from './metadata.js';
export * from './note.js';
export * from './notebook.js';
export * from './invariants.js';
// Re-export wikilinks from the dedicated package
export { extractWikilinks, extractWikilinkTargets } from '@readied/wikilinks';
export type { WikilinkRef } from '@readied/wikilinks';
