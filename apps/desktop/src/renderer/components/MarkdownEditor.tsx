/**
 * CodeMirror 6 Markdown Editor
 */

import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle, useMemo } from 'react';
import { EditorState, type Extension } from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
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
} from './editor/toolbar-commands';
import {
  wikilinkExtension,
  createWikilinkAutocomplete,
  setCurrentNoteId,
  currentNoteIdField,
} from '@readied/wikilinks';

/** Dark theme matching Readied's design */
const darkTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: 'transparent',
      color: '#f4f4f5',
      fontSize: '14px',
      height: '100%',
    },
    '.cm-content': {
      fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
      padding: '12px',
      lineHeight: '1.7',
      caretColor: '#5eead4',
    },
    '.cm-cursor': {
      borderLeftColor: '#5eead4',
      borderLeftWidth: '2px',
    },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
      backgroundColor: 'rgba(94, 234, 212, 0.2)',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
    },
    '.cm-gutters': {
      backgroundColor: 'transparent',
      borderRight: '1px solid rgba(255, 255, 255, 0.06)',
      color: 'rgba(255, 255, 255, 0.25)',
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
      backgroundColor: 'rgba(94, 234, 212, 0.3)',
      outline: 'none',
    },
    // Autocomplete tooltip
    '.cm-tooltip-autocomplete': {
      backgroundColor: 'rgba(24, 24, 27, 0.98)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '8px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
      overflow: 'hidden',
    },
    '.cm-tooltip-autocomplete > ul': {
      fontFamily: "'Inter', -apple-system, sans-serif",
      fontSize: '13px',
      maxHeight: '300px',
    },
    '.cm-tooltip-autocomplete > ul > li': {
      padding: '8px 12px',
      color: '#a1a1aa',
      cursor: 'pointer',
    },
    '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
      backgroundColor: 'rgba(94, 234, 212, 0.15)',
      color: '#5eead4',
    },
    '.cm-completionLabel': {
      fontWeight: '500',
    },
  },
  { dark: true }
);

/** Syntax highlighting for Markdown */
const markdownHighlighting = HighlightStyle.define([
  // Headings
  { tag: tags.heading1, color: '#5eead4', fontWeight: '700', fontSize: '1.5em' },
  { tag: tags.heading2, color: '#5eead4', fontWeight: '600', fontSize: '1.3em' },
  { tag: tags.heading3, color: '#5eead4', fontWeight: '600', fontSize: '1.15em' },
  { tag: tags.heading4, color: '#5eead4', fontWeight: '600' },
  { tag: tags.heading5, color: '#5eead4', fontWeight: '600' },
  { tag: tags.heading6, color: '#5eead4', fontWeight: '600' },

  // Emphasis
  { tag: tags.emphasis, fontStyle: 'italic', color: '#fbbf24' },
  { tag: tags.strong, fontWeight: '700', color: '#f4f4f5' },
  { tag: tags.strikethrough, textDecoration: 'line-through', color: 'rgba(255, 255, 255, 0.5)' },

  // Code
  {
    tag: tags.monospace,
    fontFamily: "'JetBrains Mono', monospace",
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    padding: '2px 4px',
    borderRadius: '3px',
  },

  // Links
  { tag: tags.link, color: '#60a5fa', textDecoration: 'underline' },
  { tag: tags.url, color: '#60a5fa' },

  // Lists
  { tag: tags.list, color: '#a78bfa' },

  // Quotes
  {
    tag: tags.quote,
    color: 'rgba(255, 255, 255, 0.6)',
    fontStyle: 'italic',
    borderLeft: '3px solid rgba(94, 234, 212, 0.5)',
    paddingLeft: '12px',
  },

  // Meta (like --- for frontmatter)
  { tag: tags.meta, color: 'rgba(255, 255, 255, 0.4)' },
  { tag: tags.comment, color: 'rgba(255, 255, 255, 0.4)' },

  // Punctuation
  { tag: tags.processingInstruction, color: 'rgba(255, 255, 255, 0.4)' },
]);

interface MarkdownEditorProps {
  initialContent: string;
  onChange: (content: string) => void;
  placeholder?: string;
  onReady?: () => void;
  /** Current note ID (for excluding from wikilink autocomplete) */
  noteId?: string;
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
    { initialContent, onChange, placeholder = 'Start writing...', onReady, noteId },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onChangeRef = useRef(onChange);

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

    // Keep onChange ref updated
    onChangeRef.current = onChange;

    // Create extensions
    const createExtensions = useCallback((): Extension[] => {
      return [
        // Line numbers
        lineNumbers(),

        // Line wrapping (responsive text)
        EditorView.lineWrapping,

        // Active line highlighting
        highlightActiveLine(),
        highlightActiveLineGutter(),

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

        // Dark theme
        darkTheme,

        // Placeholder
        EditorView.contentAttributes.of({ 'data-placeholder': placeholder }),

        // Update listener
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            const content = update.state.doc.toString();
            onChangeRef.current(content);
          }
        }),
      ];
    }, [placeholder, wikilinkAutocomplete]);

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

      return () => {
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

    return <div ref={containerRef} className="markdown-editor" />;
  }
);
