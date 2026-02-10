/**
 * Wikilink Autocomplete Extension
 *
 * Provides autocomplete suggestions for wikilinks when typing [[.
 * Shows a searchable list of note titles.
 */

import {
  type CompletionContext,
  type CompletionResult,
  autocompletion,
} from '@codemirror/autocomplete';
import type { EditorView } from '@codemirror/view';
import { StateField, StateEffect, type Extension } from '@codemirror/state';
import type { WikilinkNote } from '../../core/contracts.js';

/** Configuration for the autocomplete extension */
interface WikilinkAutocompleteConfig {
  /** Search notes by query */
  searchNotes: (query: string) => Promise<WikilinkNote[]>;
  /** List recent notes (no query) */
  listNotes: () => Promise<WikilinkNote[]>;
}

/** Effect to update the current note ID in editor state */
export const setCurrentNoteId = StateEffect.define<string | null>();

/** StateField to store the current note ID (for excluding from suggestions) */
export const currentNoteIdField = StateField.define<string | null>({
  create: () => null,
  update: (value, tr) => {
    for (const effect of tr.effects) {
      if (effect.is(setCurrentNoteId)) return effect.value;
    }
    return value;
  },
});

/**
 * Create a wikilink autocomplete extension.
 *
 * Uses dependency injection for note fetching to keep the extension
 * decoupled from IPC/API implementation.
 *
 * @param config - Functions to search and list notes
 * @returns CodeMirror extension array
 */
export function createWikilinkAutocomplete(config: WikilinkAutocompleteConfig): Extension {
  const { searchNotes, listNotes } = config;

  /**
   * Check if position is inside a fenced code block or inline code.
   * Uses plain text scanning to avoid a dependency on @codemirror/language.
   */
  function isInsideCode(context: CompletionContext): boolean {
    const { state, pos } = context;
    const doc = state.doc;
    const textBefore = doc.sliceString(0, pos);

    // Check inline code: odd number of unescaped backticks (not triple) on the current line
    const lineStart = textBefore.lastIndexOf('\n') + 1;
    const lineText = textBefore.slice(lineStart);
    // Remove triple backticks (code fences) from inline check
    const inlineText = lineText.replace(/```/g, '');
    const backtickCount = (inlineText.match(/(?<!\\)`/g) || []).length;
    if (backtickCount % 2 === 1) return true;

    // Check fenced code block: count opening/closing ``` fences before cursor
    const fences = textBefore.match(/^```/gm) || [];
    if (fences.length % 2 === 1) return true;

    return false;
  }

  async function wikilinkCompletions(context: CompletionContext): Promise<CompletionResult | null> {
    // Don't activate inside code blocks or inline code
    if (isInsideCode(context)) return null;

    // Match [[ followed by any characters except [ and ]
    const match = context.matchBefore(/\[\[[^\][]*/);
    if (!match) return null;

    // Extract query (text after [[)
    const query = match.text.slice(2);

    // Get currentNoteId from state to exclude from suggestions
    const currentNoteId = context.state.field(currentNoteIdField, false);

    // Fetch notes using injected functions
    let notes = query.trim() ? await searchNotes(query) : await listNotes();

    // Exclude current note from suggestions
    if (currentNoteId) {
      notes = notes.filter(n => n.id !== currentNoteId);
    }

    // NOTE: Empty result is valid UX (matches Obsidian behavior).
    // The autocomplete closes silently when no notes match — this is intentional.

    return {
      from: match.from,
      options: notes.slice(0, 15).map(note => ({
        label: note.title,
        apply: (view: EditorView, _completion: unknown, from: number, to: number) => {
          // CONTRACT: Wikilinks are inserted as [[title]].
          // Future migration to [[id|title]] format must happen here only.
          const text = `[[${note.title}]]`;
          view.dispatch({
            changes: { from, to, insert: text },
            selection: { anchor: from + text.length },
          });
        },
      })),
      filter: false, // Already filtered via searchNotes()
    };
  }

  return [
    currentNoteIdField,
    autocompletion({
      override: [wikilinkCompletions],
      activateOnTyping: true,
      maxRenderedOptions: 15,
    }),
  ];
}
