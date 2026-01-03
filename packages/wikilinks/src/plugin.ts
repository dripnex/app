/**
 * Wikilink Plugin Factory
 *
 * This is the ONLY public entry point of the wikilinks system.
 * Consumers should not compose editor/remark parts manually
 * unless they know exactly what they are doing.
 */

import type { Extension } from '@codemirror/state';
import type { WikilinkResolver } from './core/contracts.js';
import { createWikilinkAutocomplete } from './adapters/codemirror/autocomplete.js';
import { wikilinkExtension } from './adapters/codemirror/highlight.js';
import { remarkWikilink } from './adapters/remark/remark-wikilink.js';

/** Minimal Plugin type - remark-compatible function */
type RemarkPlugin = typeof remarkWikilink;

export interface WikilinkPlugin {
  /** CodeMirror extensions for editor (highlighting + autocomplete) */
  editorExtensions: Extension[];
  /** Remark plugin for preview */
  remarkPlugin: RemarkPlugin;
}

/**
 * Create a complete wikilink plugin for both editor and preview.
 *
 * @param resolver - Pure data fetching functions (search, list)
 * @returns Plugin with editorExtensions and remarkPlugin
 *
 * @example
 * const plugin = createWikilinkPlugin({
 *   search: async (query) => notes.filter(n => n.title.includes(query)),
 *   list: async () => recentNotes,
 * });
 *
 * // In CodeMirror:
 * extensions: [...plugin.editorExtensions]
 *
 * // In unified/remark:
 * .use(plugin.remarkPlugin)
 */
export function createWikilinkPlugin(resolver: WikilinkResolver): WikilinkPlugin {
  return {
    editorExtensions: [
      wikilinkExtension,
      createWikilinkAutocomplete({
        searchNotes: resolver.search.bind(resolver),
        listNotes: resolver.list.bind(resolver),
      }),
    ],
    remarkPlugin: remarkWikilink,
  };
}
