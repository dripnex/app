/**
 * Wikilink Contracts
 *
 * Pure interfaces for the wikilinks system.
 * No dependencies on Electron, React, or any external library.
 */

/**
 * Minimal note representation for wikilinks.
 * The plugin doesn't need to know about full Note entity.
 */
export interface WikilinkNote {
  id: string;
  title: string;
}

/**
 * Resolver interface - pure data fetching.
 * No side effects. Implemented by the app.
 */
export interface WikilinkResolver {
  /** Search notes by query */
  search(query: string): Promise<WikilinkNote[]>;
  /** List recent notes (empty query) */
  list(): Promise<WikilinkNote[]>;
}

// NOTE: WikilinkActions (navigateTo) will be added when the first
// side-effect is needed. We don't add parameters "just in case".
