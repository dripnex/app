/**
 * Wikilink Autocomplete Extension
 *
 * Provides autocomplete suggestions for wikilinks when typing [[.
 * Shows a searchable list of note titles.
 */

import {
  type CompletionContext,
  type CompletionResult,
  type CompletionSource,
  autocompletion,
} from '@codemirror/autocomplete';
import type { EditorView } from '@codemirror/view';
import { StateField, StateEffect, type Extension } from '@codemirror/state';
import type { WikilinkNote } from '../../core/contracts.js';
import { extractHeadings, filterHeadings, splitWikilinkQuery } from '../../core/headings.js';

/** Configuration for the autocomplete extension */
interface WikilinkAutocompleteConfig {
  /** Search notes by query */
  searchNotes: (query: string) => Promise<WikilinkNote[]>;
  /** List recent notes (no query) */
  listNotes: () => Promise<WikilinkNote[]>;
  /** Extra completion sources (e.g. emoji shortcodes) */
  extraSources?: CompletionSource[];
  /** Create a note from the typed title. Link is inserted first. */
  createNote?: (title: string) => void | Promise<void>;
  /** Load a note's markdown so `[[Title#` can complete headings. */
  getNoteContent?: (id: string) => Promise<string | null>;
}

/** Offer "Create …" when the query is non-empty and not an exact title. */
export function createWikilinkTitle(query: string, notes: WikilinkNote[]): string | null {
  const title = query.trim().replace(/[\r\n\]]/g, '');
  if (!title) return null;
  if (notes.some(n => n.title.toLowerCase() === title.toLowerCase())) return null;
  return title;
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
  const { searchNotes, listNotes, extraSources = [], createNote, getNoteContent } = config;

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
    const headingQuery = splitWikilinkQuery(query);
    if (headingQuery) {
      let content: string | null = null;
      if (!headingQuery.title) {
        content = context.state.doc.toString();
      } else if (getNoteContent) {
        const notes = await searchNotes(headingQuery.title);
        const hit = notes.find(n => n.title.toLowerCase() === headingQuery.title.toLowerCase());
        if (hit) content = await getNoteContent(hit.id);
      }
      if (content == null) return null;
      const headings = filterHeadings(extractHeadings(content), headingQuery.heading);
      if (headings.length === 0) return null;
      const titlePrefix = headingQuery.title;
      return {
        from: match.from,
        options: headings.slice(0, 14).map(heading => ({
          label: heading.text,
          detail: '#'.repeat(heading.level),
          apply: (view: EditorView, _completion: unknown, from: number, to: number) => {
            const text = titlePrefix
              ? `[[${titlePrefix}#${heading.text}]]`
              : `[[#${heading.text}]]`;
            view.dispatch({
              changes: { from, to, insert: text },
              selection: { anchor: from + text.length },
            });
          },
        })),
        filter: false,
      };
    }

    // Get currentNoteId from state to exclude from suggestions
    const currentNoteId = context.state.field(currentNoteIdField, false);

    // Fetch notes using injected functions
    let notes = query.trim() ? await searchNotes(query) : await listNotes();

    // Exclude current note from suggestions
    if (currentNoteId) {
      notes = notes.filter(n => n.id !== currentNoteId);
    }

    const onCreate = createNote;
    const createTitle = onCreate ? createWikilinkTitle(query, notes) : null;
    const options = notes.slice(0, 14).map(note => ({
      label: note.title,
      apply: (view: EditorView, _completion: unknown, from: number, to: number) => {
        const text = `[[${note.title}]]`;
        view.dispatch({
          changes: { from, to, insert: text },
          selection: { anchor: from + text.length },
        });
      },
    }));

    if (createTitle && onCreate) {
      const make = onCreate;
      options.unshift({
        label: `Create “${createTitle}”`,
        apply: (view: EditorView, _completion: unknown, from: number, to: number) => {
          const text = `[[${createTitle}]]`;
          view.dispatch({
            changes: { from, to, insert: text },
            selection: { anchor: from + text.length },
          });
          void make(createTitle);
        },
      });
    }

    if (options.length === 0) return null;

    return {
      from: match.from,
      options,
      filter: false,
    };
  }

  return [
    currentNoteIdField,
    autocompletion({
      override: [wikilinkCompletions, ...extraSources],
      activateOnTyping: true,
      maxRenderedOptions: 15,
    }),
  ];
}
