/**
 * CodeMirror 6 Markdown Editor
 */

import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle, useMemo } from 'react';
import { EditorState, EditorSelection, type Extension, Compartment } from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { indentUnit } from '@codemirror/language';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { syntaxHighlighting, indentOnInput, bracketMatching } from '@codemirror/language';
import {
  toggleBold,
  toggleItalic,
  toggleStrikethrough,
  toggleInlineCode,
  insertLink,
  insertHeading,
  insertUnorderedList,
  insertOrderedList,
  insertCheckbox,
  insertQuote,
  insertCodeBlock,
  insertHorizontalRule,
  undoChange,
  redoChange,
} from '@dripnex/commands';
import {
  wikilinkExtension,
  createWikilinkAutocomplete,
  setCurrentNoteId,
  currentNoteIdField,
} from '@dripnex/wikilinks';
import { embedInlinePreview } from '@dripnex/embeds/codemirror';
import { pluginExtensionCompartment, editorPluginStore } from '@dripnex/plugin-api';
import { htmlToGfmMarkdown } from '../utils/htmlToMarkdown';
import { useEditorBufferStore } from '../stores/editorBufferStore';
import { useSettingsStore, selectEditor } from '../stores/settings';
import { setEditorView } from '../hooks/useCommandRegistry';
import { createEditorTheme, markdownHighlighting, SCROLL_PAST_END_PADDING } from './editorTheme.js';

// Compartments for dynamic settings
const lineNumbersCompartment = new Compartment();
const activeLineCompartment = new Compartment();
const lineWrappingCompartment = new Compartment();
const themeCompartment = new Compartment();
const tabSizeCompartment = new Compartment();
const scrollPastEndCompartment = new Compartment();
const spellCheckCompartment = new Compartment();

// createEditorTheme, markdownHighlighting, and SCROLL_PAST_END_PADDING
// live in editorTheme.ts.

interface MarkdownEditorProps {
  initialContent: string;
  onChange: (content: string) => void;
  placeholder?: string;
  onReady?: () => void;
  /** Current note ID (for excluding from wikilink autocomplete) */
  noteId?: string;
  /** Callback to get resolved embed URL (for inline image preview) */
  getEmbedUrl?: (target: string) => string | null;
}

/** Imperative handle exposed via ref */
export interface MarkdownEditorHandle {
  focus: () => void;
  // Formatting commands
  toggleBold: () => void;
  toggleItalic: () => void;
  toggleStrikethrough: () => void;
  toggleInlineCode: () => void;
  insertLink: () => void;
  insertHeading: (level?: 1 | 2 | 3 | 4 | 5 | 6) => void;
  insertUnorderedList: () => void;
  insertOrderedList: () => void;
  insertCheckbox: () => void;
  insertQuote: () => void;
  insertCodeBlock: () => void;
  insertHorizontalRule: () => void;
  undo: () => void;
  redo: () => void;
  // Scroll sync
  getScrollFraction: () => number;
  setScrollFraction: (fraction: number) => void;
  onScroll: (callback: (fraction: number) => void) => () => void;
  canScroll: () => boolean;
}

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  function MarkdownEditor(
    { initialContent, onChange, placeholder = 'Start writing...', onReady, noteId, getEmbedUrl },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onChangeRef = useRef(onChange);
    const noteIdRef = useRef(noteId);
    const getEmbedUrlRef = useRef(getEmbedUrl);

    // Get editor settings
    const editorSettings = useSettingsStore(selectEditor);

    // Create wikilink autocomplete extension with injected dependencies
    const wikilinkAutocomplete = useMemo(
      () =>
        createWikilinkAutocomplete({
          searchNotes: async query => {
            const notes = await window.dripnex.notes.search(query, 20);
            return notes.map(n => ({ id: n.id, title: n.title }));
          },
          listNotes: async () => {
            const notes = await window.dripnex.notes.list({
              sortBy: 'updatedAt',
              sortOrder: 'desc',
              archived: 'active',
            });
            return notes.map(n => ({ id: n.id, title: n.title }));
          },
        }),
      []
    );

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      focus: () => {
        viewRef.current?.focus();
      },
      toggleBold: () => {
        if (viewRef.current) toggleBold(viewRef.current);
      },
      toggleItalic: () => {
        if (viewRef.current) toggleItalic(viewRef.current);
      },
      toggleStrikethrough: () => {
        if (viewRef.current) toggleStrikethrough(viewRef.current);
      },
      toggleInlineCode: () => {
        if (viewRef.current) toggleInlineCode(viewRef.current);
      },
      insertLink: () => {
        if (viewRef.current) insertLink(viewRef.current);
      },
      insertHeading: (level: 1 | 2 | 3 | 4 | 5 | 6 = 2) => {
        if (viewRef.current) insertHeading(viewRef.current, level);
      },
      insertUnorderedList: () => {
        if (viewRef.current) insertUnorderedList(viewRef.current);
      },
      insertOrderedList: () => {
        if (viewRef.current) insertOrderedList(viewRef.current);
      },
      insertCheckbox: () => {
        if (viewRef.current) insertCheckbox(viewRef.current);
      },
      insertQuote: () => {
        if (viewRef.current) insertQuote(viewRef.current);
      },
      insertCodeBlock: () => {
        if (viewRef.current) insertCodeBlock(viewRef.current);
      },
      insertHorizontalRule: () => {
        if (viewRef.current) insertHorizontalRule(viewRef.current);
      },
      undo: () => {
        if (viewRef.current) undoChange(viewRef.current);
      },
      redo: () => {
        if (viewRef.current) redoChange(viewRef.current);
      },
      getScrollFraction: () => {
        const view = viewRef.current;
        if (!view) return 0;
        const scroller = view.scrollDOM;
        const maxScroll = scroller.scrollHeight - scroller.clientHeight;
        return maxScroll > 0 ? scroller.scrollTop / maxScroll : 0;
      },
      canScroll: () => {
        const view = viewRef.current;
        if (!view) return false;
        const scroller = view.scrollDOM;
        return scroller.scrollHeight > scroller.clientHeight + 1;
      },
      setScrollFraction: (fraction: number) => {
        const view = viewRef.current;
        if (!view) return;
        const scroller = view.scrollDOM;
        const maxScroll = scroller.scrollHeight - scroller.clientHeight;
        scroller.scrollTop = fraction * maxScroll;
      },
      onScroll: (callback: (fraction: number) => void) => {
        const view = viewRef.current;
        if (!view) return () => {};
        const scroller = view.scrollDOM;
        const handler = () => {
          const maxScroll = scroller.scrollHeight - scroller.clientHeight;
          const fraction = maxScroll > 0 ? scroller.scrollTop / maxScroll : 0;
          callback(fraction);
        };
        scroller.addEventListener('scroll', handler);
        return () => scroller.removeEventListener('scroll', handler);
      },
    }));

    // Keep refs updated
    onChangeRef.current = onChange;
    noteIdRef.current = noteId;
    getEmbedUrlRef.current = getEmbedUrl;

    // Create extensions with configurable settings via compartments
    const createExtensions = useCallback((): Extension[] => {
      const {
        lineNumbers: showLineNumbers,
        highlightActiveLine: showActiveLine,
        lineWrapping,
        fontSize,
        fontFamily,
        lineHeight,
        tabSize,
        indentWithTabs,
        scrollPastEnd,
        spellCheck,
      } = editorSettings;

      return [
        // Global plugin error sink — catches exceptions thrown by view plugins
        // (instead of crashing the EditorView). Logs to console + Sentry if wired.
        EditorView.exceptionSink.of(err => {
          console.error('[CodeMirror] plugin error:', err);
          const sentry = (
            globalThis as unknown as {
              Sentry?: { captureException: (e: unknown, ctx?: unknown) => void };
            }
          ).Sentry;
          sentry?.captureException(err, { tags: { source: 'codemirror' } });
        }),

        // Configurable: Line numbers
        lineNumbersCompartment.of(showLineNumbers ? lineNumbers() : []),

        // Configurable: Line wrapping
        lineWrappingCompartment.of(lineWrapping ? EditorView.lineWrapping : []),

        // Configurable: Active line highlighting
        activeLineCompartment.of(
          showActiveLine ? [highlightActiveLine(), highlightActiveLineGutter()] : []
        ),

        // Configurable: Tab size and indent unit
        tabSizeCompartment.of([
          EditorState.tabSize.of(tabSize),
          indentUnit.of(indentWithTabs ? '\t' : ' '.repeat(tabSize)),
        ]),

        // Configurable: Theme with font settings
        themeCompartment.of(createEditorTheme(fontSize, fontFamily, lineHeight)),

        // Configurable: Scroll past end (via CSS padding on scroller)
        scrollPastEndCompartment.of(
          scrollPastEnd
            ? EditorView.theme({ '.cm-scroller': { paddingBottom: SCROLL_PAST_END_PADDING } })
            : []
        ),

        // Configurable: Spell check
        spellCheckCompartment.of(
          EditorView.contentAttributes.of({ spellcheck: spellCheck ? 'true' : 'false' })
        ),

        // Selection
        drawSelection(),

        // History (undo/redo)
        history(),

        // Bracket matching
        bracketMatching(),

        // Auto indent
        indentOnInput(),

        // Keymaps
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),

        // Markdown language with nested code highlighting
        markdown({
          base: markdownLanguage,
          codeLanguages: languages,
        }),

        // Syntax highlighting
        syntaxHighlighting(markdownHighlighting),

        // Wikilink [[note]] highlighting
        wikilinkExtension,

        // Wikilink autocomplete (triggers on [[)
        wikilinkAutocomplete,

        // Embed inline preview (shows images after ![[...]] syntax)
        embedInlinePreview(target => getEmbedUrlRef.current?.(target) ?? null),

        // Placeholder
        EditorView.contentAttributes.of({ 'data-placeholder': placeholder }),

        // Plugin extensions compartment (reconfigured dynamically)
        pluginExtensionCompartment.of([]),

        // Update listener
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            const content = update.state.doc.toString();
            // Update live buffer immediately (for preview sync)
            useEditorBufferStore.getState().updateBuffer(content);
            // Trigger debounced save via callback
            onChangeRef.current(content);
          }
        }),
      ];
    }, [placeholder, wikilinkAutocomplete, editorSettings]);

    // Initialize editor
    useEffect(() => {
      if (!containerRef.current) return;

      const state = EditorState.create({
        doc: initialContent,
        extensions: createExtensions(),
      });

      const view = new EditorView({
        state,
        parent: containerRef.current,
      });

      viewRef.current = view;

      // Expose to command registry
      setEditorView(view);

      // Focus the editor
      view.focus();

      // Notify parent that editor is ready
      onReady?.();

      // Handle image drop
      const handleDrop = async (e: DragEvent) => {
        const file = e.dataTransfer?.files[0];
        if (!file?.type.startsWith('image/')) return;
        const currentNoteId = noteIdRef.current;
        if (!currentNoteId) return;

        e.preventDefault();

        const bytes = await file.arrayBuffer();
        const result = await window.dripnex.embeds.saveAsset(
          currentNoteId,
          file.type,
          bytes,
          file.name
        );
        if (!result.ok) {
          console.error('Failed to save asset:', result.error);
          return;
        }

        const embed = `![[${result.filename}]]`;
        const pos = view.state.selection.main.head;
        view.dispatch({
          changes: { from: pos, insert: embed },
          selection: EditorSelection.cursor(pos + embed.length),
          userEvent: 'input.drop',
        });
      };

      // Handle paste: HTML tables → GFM markdown, images → embed, URLs → auto-link
      const handlePaste = async (e: ClipboardEvent) => {
        // 1. Check for HTML with tables – convert to GFM markdown
        const html = e.clipboardData?.getData('text/html');
        if (html && /<table[\s>]/i.test(html)) {
          e.preventDefault();
          const md = htmlToGfmMarkdown(html);
          const pos = view.state.selection.main.head;
          view.dispatch({
            changes: { from: pos, insert: md },
            selection: EditorSelection.cursor(pos + md.length),
            userEvent: 'input.paste',
          });
          return;
        }

        // 2. Check for image paste
        const items = Array.from(e.clipboardData?.items || []);
        const imageItem = items.find(i => i.type.startsWith('image/'));

        if (imageItem) {
          const currentNoteId = noteIdRef.current;
          if (!currentNoteId) return;

          e.preventDefault();
          const blob = imageItem.getAsFile();
          if (!blob) return;

          const bytes = await blob.arrayBuffer();
          const result = await window.dripnex.embeds.saveAsset(currentNoteId, blob.type, bytes);
          if (!result.ok) {
            console.error('Failed to save asset:', result.error);
            return;
          }

          const embed = `![[${result.filename}]]`;
          const pos = view.state.selection.main.head;
          view.dispatch({
            changes: { from: pos, insert: embed },
            selection: EditorSelection.cursor(pos + embed.length),
            userEvent: 'input.paste',
          });
          return;
        }

        // 3. Check for URL paste — auto-link with fetched title
        const plainText = e.clipboardData?.getData('text/plain')?.trim();
        if (plainText && /^https?:\/\/\S+$/.test(plainText)) {
          // Check if cursor is already inside a markdown link syntax
          const pos = view.state.selection.main.head;
          const lineText = view.state.doc.lineAt(pos).text;
          const lineOffset = pos - view.state.doc.lineAt(pos).from;
          const textBefore = lineText.slice(0, lineOffset);
          // If we're inside [...] or (...) of a link, don't intercept
          const openBracket = textBefore.lastIndexOf('[');
          const closeBracket = textBefore.lastIndexOf(']');
          const openParen = textBefore.lastIndexOf('(');
          const closeParen = textBefore.lastIndexOf(')');
          if (
            openBracket > closeBracket || // inside [...]
            openParen > closeParen // inside (...)
          ) {
            return; // Let default paste handle it
          }

          e.preventDefault();

          // Insert raw URL immediately
          const from = view.state.selection.main.from;
          const to = view.state.selection.main.to;
          view.dispatch({
            changes: { from, to, insert: plainText },
            selection: EditorSelection.cursor(from + plainText.length),
            userEvent: 'input.paste',
          });

          // Fetch title in background and replace with markdown link.
          // Track the exact range where we inserted the URL so later
          // edits don't cause us to rewrite the wrong occurrence.
          const insertedFrom = from;
          const insertedTo = from + plainText.length;
          window.dripnex.editor
            .fetchUrlTitle(plainText)
            .then(({ title }) => {
              if (!title) return;
              // Verify the URL still sits at the expected position
              const currentDoc = view.state.doc.toString();
              const textAtRange = currentDoc.slice(insertedFrom, insertedTo);
              if (textAtRange !== plainText) return;
              // Verify it's still a bare URL (not already wrapped in markdown link)
              const charBefore = insertedFrom > 0 ? currentDoc[insertedFrom - 1] : '';
              if (charBefore === '(' || charBefore === '<') return;
              const mdLink = `[${title}](${plainText})`;
              view.dispatch({
                changes: { from: insertedFrom, to: insertedTo, insert: mdLink },
                selection: EditorSelection.cursor(insertedFrom + mdLink.length),
                userEvent: 'input.paste',
              });
            })
            .catch(() => {
              // Fetch failed — URL was already inserted, nothing to do
            });
          return;
        }
      };

      // Add event listeners to the editor DOM
      const dom = view.dom;
      dom.addEventListener('drop', handleDrop);
      dom.addEventListener('paste', handlePaste);

      return () => {
        dom.removeEventListener('drop', handleDrop);
        dom.removeEventListener('paste', handlePaste);
        setEditorView(null);
        view.destroy();
        viewRef.current = null;
      };
    }, []); // Only run once on mount

    // Update content when initialContent changes (new note selected)
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;

      const currentContent = view.state.doc.toString();
      if (currentContent !== initialContent) {
        const { selection } = view.state;

        view.dispatch({
          changes: {
            from: 0,
            to: view.state.doc.length,
            insert: initialContent,
          },
          selection, // Preserve cursor (CodeMirror clamps if invalid)
        });
      }
    }, [initialContent]);

    // Update currentNoteId in editor state (for autocomplete filtering)
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;

      // Guard: avoid redundant dispatch
      const current = view.state.field(currentNoteIdField, false);
      if (current === noteId) return;

      const { selection } = view.state;

      view.dispatch({
        effects: setCurrentNoteId.of(noteId ?? null),
        selection, // Preserve cursor position
      });
    }, [noteId]);

    // Reconfigure plugin extensions when registrations change.
    // Also apply current snapshot on mount so extensions registered before
    // the editor exists (e.g. decoration plugins) are active immediately.
    useEffect(() => {
      const apply = () => {
        const view = viewRef.current;
        if (!view) return;
        const merged = editorPluginStore.getState().getMergedExtensions();
        view.dispatch({
          effects: pluginExtensionCompartment.reconfigure(merged),
        });
      };

      // Apply current snapshot
      apply();

      // Subscribe to future changes
      const unsubscribe = editorPluginStore.subscribe(apply);
      return unsubscribe;
    }, []);

    // Reconfigure editor when settings change
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;

      const {
        lineNumbers: showLineNumbers,
        highlightActiveLine: showActiveLine,
        lineWrapping,
        fontSize,
        fontFamily,
        lineHeight,
        tabSize,
        indentWithTabs,
        scrollPastEnd,
        spellCheck,
      } = editorSettings;

      view.dispatch({
        effects: [
          lineNumbersCompartment.reconfigure(showLineNumbers ? lineNumbers() : []),
          lineWrappingCompartment.reconfigure(lineWrapping ? EditorView.lineWrapping : []),
          activeLineCompartment.reconfigure(
            showActiveLine ? [highlightActiveLine(), highlightActiveLineGutter()] : []
          ),
          tabSizeCompartment.reconfigure([
            EditorState.tabSize.of(tabSize),
            indentUnit.of(indentWithTabs ? '\t' : ' '.repeat(tabSize)),
          ]),
          themeCompartment.reconfigure(createEditorTheme(fontSize, fontFamily, lineHeight)),
          scrollPastEndCompartment.reconfigure(
            scrollPastEnd
              ? EditorView.theme({ '.cm-scroller': { paddingBottom: SCROLL_PAST_END_PADDING } })
              : []
          ),
          spellCheckCompartment.reconfigure(
            EditorView.contentAttributes.of({ spellcheck: spellCheck ? 'true' : 'false' })
          ),
        ],
      });
    }, [editorSettings]);

    return <div ref={containerRef} className="markdown-editor" />;
  }
);
