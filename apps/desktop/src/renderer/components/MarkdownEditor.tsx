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
import {
  syntaxHighlighting,
  HighlightStyle,
  indentOnInput,
  bracketMatching,
} from '@codemirror/language';
import { tags } from '@lezer/highlight';
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
} from '@readied/commands';
import {
  wikilinkExtension,
  createWikilinkAutocomplete,
  setCurrentNoteId,
  currentNoteIdField,
} from '@readied/wikilinks';
import { embedInlinePreview } from '@readied/embeds/codemirror';
import { useEditorBufferStore } from '../stores/editorBufferStore';
import { useSettingsStore, selectEditor } from '../stores/settings';

// Compartments for dynamic settings
const lineNumbersCompartment = new Compartment();
const activeLineCompartment = new Compartment();
const lineWrappingCompartment = new Compartment();
const themeCompartment = new Compartment();
const tabSizeCompartment = new Compartment();
const scrollPastEndCompartment = new Compartment();
const spellCheckCompartment = new Compartment();

/** Scroll past end padding - allows scrolling content to top of viewport */
const SCROLL_PAST_END_PADDING = '50vh';

/** Create theme with configurable settings (uses CSS variables for colors) */
function createEditorTheme(fontSize: number, fontFamily: string, lineHeight: number) {
  return EditorView.theme({
    '&': {
      backgroundColor: 'transparent',
      color: 'var(--cm-text)',
      fontSize: `${fontSize}px`,
      height: '100%',
    },
    '.cm-content': {
      fontFamily: fontFamily || "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
      padding: '12px',
      lineHeight: String(lineHeight),
      caretColor: 'var(--cm-cursor)',
    },
    '.cm-cursor': {
      borderLeftColor: 'var(--cm-cursor)',
      borderLeftWidth: '2px',
    },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
      backgroundColor: 'var(--cm-selection)',
    },
    '.cm-activeLine': {
      backgroundColor: 'var(--cm-active-line)',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'var(--cm-active-line)',
    },
    '.cm-gutters': {
      backgroundColor: 'transparent',
      borderRight: '1px solid var(--cm-gutter-border)',
      color: 'var(--cm-gutter-text)',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      padding: '0 12px 0 16px',
      minWidth: '40px',
    },
    '.cm-scroller': {
      overflow: 'auto',
    },
    '.cm-line': {
      padding: '0 4px',
    },
    '&.cm-focused .cm-matchingBracket': {
      backgroundColor: 'var(--cm-bracket-match)',
      outline: 'none',
    },
    // Autocomplete tooltip
    '.cm-tooltip-autocomplete': {
      backgroundColor: 'var(--cm-tooltip-bg)',
      backdropFilter: 'blur(12px)',
      border: '1px solid var(--cm-tooltip-border)',
      borderRadius: '8px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
      overflow: 'hidden',
    },
    '.cm-tooltip-autocomplete > ul': {
      fontFamily: "'Inter', -apple-system, sans-serif",
      fontSize: '13px',
      maxHeight: '300px',
    },
    '.cm-tooltip-autocomplete > ul > li': {
      padding: '8px 12px',
      color: 'var(--cm-tooltip-text)',
      cursor: 'pointer',
    },
    '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
      backgroundColor: 'var(--accent-muted)',
      color: 'var(--accent)',
    },
    '.cm-completionLabel': {
      fontWeight: '500',
    },
  });
}

/** Syntax highlighting for Markdown (uses CSS variables for theme-aware colors) */
const markdownHighlighting = HighlightStyle.define([
  // Headings
  { tag: tags.heading1, color: 'var(--cm-heading)', fontWeight: '700', fontSize: '1.5em' },
  { tag: tags.heading2, color: 'var(--cm-heading)', fontWeight: '600', fontSize: '1.3em' },
  { tag: tags.heading3, color: 'var(--cm-heading)', fontWeight: '600', fontSize: '1.15em' },
  { tag: tags.heading4, color: 'var(--cm-heading)', fontWeight: '600' },
  { tag: tags.heading5, color: 'var(--cm-heading)', fontWeight: '600' },
  { tag: tags.heading6, color: 'var(--cm-heading)', fontWeight: '600' },

  // Emphasis
  { tag: tags.emphasis, fontStyle: 'italic', color: 'var(--cm-emphasis)' },
  { tag: tags.strong, fontWeight: '700', color: 'var(--cm-strong)' },
  { tag: tags.strikethrough, textDecoration: 'line-through', color: 'var(--cm-strikethrough)' },

  // Code
  {
    tag: tags.monospace,
    fontFamily: "'JetBrains Mono', monospace",
    backgroundColor: 'var(--cm-code-bg)',
    padding: '2px 4px',
    borderRadius: '3px',
  },

  // Links
  { tag: tags.link, color: 'var(--cm-link)', textDecoration: 'underline' },
  { tag: tags.url, color: 'var(--cm-link)' },

  // Lists
  { tag: tags.list, color: 'var(--cm-list)' },

  // Quotes
  {
    tag: tags.quote,
    color: 'var(--cm-quote)',
    fontStyle: 'italic',
    borderLeft: '3px solid var(--cm-quote-border)',
    paddingLeft: '12px',
  },

  // Meta (like --- for frontmatter)
  { tag: tags.meta, color: 'var(--cm-meta)' },
  { tag: tags.comment, color: 'var(--cm-meta)' },

  // Punctuation
  { tag: tags.processingInstruction, color: 'var(--cm-meta)' },
]);

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
            const notes = await window.readied.notes.search(query, 20);
            return notes.map(n => ({ id: n.id, title: n.title }));
          },
          listNotes: async () => {
            const notes = await window.readied.notes.list({
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
        const result = await window.readied.embeds.saveAsset(
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

      // Handle image paste (Cmd+V)
      const handlePaste = async (e: ClipboardEvent) => {
        const items = Array.from(e.clipboardData?.items || []);
        const imageItem = items.find(i => i.type.startsWith('image/'));

        if (!imageItem) return; // Let default paste handle text
        const currentNoteId = noteIdRef.current;
        if (!currentNoteId) return;

        e.preventDefault();
        const blob = imageItem.getAsFile();
        if (!blob) return;

        const bytes = await blob.arrayBuffer();
        const result = await window.readied.embeds.saveAsset(currentNoteId, blob.type, bytes);
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
      };

      // Add event listeners to the editor DOM
      const dom = view.dom;
      dom.addEventListener('drop', handleDrop);
      dom.addEventListener('paste', handlePaste);

      return () => {
        dom.removeEventListener('drop', handleDrop);
        dom.removeEventListener('paste', handlePaste);
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
