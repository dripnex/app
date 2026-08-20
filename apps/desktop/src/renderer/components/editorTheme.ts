/**
 * CodeMirror theme + syntax highlighting for Dripnex's MarkdownEditor.
 *
 * Pure values extracted from MarkdownEditor.tsx so theme tweaks don't
 * force a rebuild of the entire editor file. Colors come from CSS
 * variables (defined in renderer/styles/) so light/dark switching works
 * without rebuilding the EditorView.
 */

import { EditorView } from '@codemirror/view';
import { HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';

/** Padding under the document so the user can scroll the last line near the top. */
export const SCROLL_PAST_END_PADDING = '50vh';

/** Build a CodeMirror theme bound to the user's font/size preferences. */
export function createEditorTheme(fontSize: number, fontFamily: string, lineHeight: number) {
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
    '.cm-foldGutter .cm-gutterElement': {
      padding: '0 4px 0 2px',
      width: '14px',
    },
    '.cm-foldPlaceholder': {
      backgroundColor: 'var(--bg-hover)',
      border: 'none',
      color: 'var(--text-muted)',
      borderRadius: '4px',
      margin: '0 4px',
      padding: '0 6px',
    },
    '.cm-scroller': {
      overflow: 'auto',
      position: 'relative',
    },
    '.cm-line': {
      padding: '0 4px',
    },
    '.md-list-mark': {
      color: 'var(--md-list-mark-color, var(--cm-list))',
    },
    '.md-list-mark-2': {
      color: 'var(--md-list-mark-2-color)',
    },
    '.md-list-mark-3': {
      color: 'var(--md-list-mark-3-color)',
    },
    '.cm-nes-ghost': {
      opacity: '0.45',
      pointerEvents: 'none',
      color: 'var(--text-muted)',
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
    '.cm-task-checked': {
      textDecoration: 'line-through',
      color: 'var(--cm-strikethrough, var(--text-muted))',
    },
    '.cm-md-link-tooltip': {
      backgroundColor: 'var(--cm-tooltip-bg, var(--bg-elevated))',
      color: 'var(--cm-link, var(--accent))',
      border: '1px solid var(--cm-tooltip-border, var(--border))',
      borderRadius: '6px',
      padding: '4px 8px',
      fontSize: '12px',
      fontFamily: "'Inter', -apple-system, sans-serif",
      maxWidth: '360px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    '.cm-fence-copy': {
      position: 'absolute',
      right: '10px',
      zIndex: '2',
      padding: '2px 8px',
      fontSize: '11px',
      lineHeight: '1.4',
      fontFamily: "'Inter', -apple-system, sans-serif",
      color: 'var(--text-secondary)',
      backgroundColor: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      borderRadius: '6px',
      cursor: 'pointer',
    },
    '.cm-fence-copy:hover': {
      color: 'var(--text-primary)',
      backgroundColor: 'var(--bg-hover)',
    },
  });
}

/** Syntax highlighting for Markdown — uses CSS variables so dark/light works. */
export const markdownHighlighting = HighlightStyle.define([
  // Headings
  { tag: tags.heading1, color: 'var(--cm-heading)', fontWeight: '700', fontSize: '1.5em' },
  { tag: tags.heading2, color: 'var(--cm-heading)', fontWeight: '600', fontSize: '1.3em' },
  { tag: tags.heading3, color: 'var(--cm-heading)', fontWeight: '600', fontSize: '1.15em' },
  { tag: tags.heading4, color: 'var(--cm-heading)', fontWeight: '600' },
  { tag: tags.heading5, color: 'var(--cm-heading)', fontWeight: '600' },
  { tag: tags.heading6, color: 'var(--cm-heading)', fontWeight: '600' },

  // Emphasis
  {
    tag: tags.emphasis,
    fontStyle: 'italic',
    color: 'var(--cm-emphasis)',
    class: 'cm-em',
  },
  {
    tag: tags.strong,
    fontWeight: '700',
    color: 'var(--cm-strong)',
    class: 'cm-strong',
  },
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

  // Lists — marker color comes from listMarkDecorations (.md-list-mark*)

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
