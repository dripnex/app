/**
 * CodeMirror 6 Markdown Editor
 */

import { useEffect, useRef, useCallback } from 'react'
import { EditorState, type Extension } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { syntaxHighlighting, HighlightStyle, indentOnInput, bracketMatching } from '@codemirror/language'
import { tags } from '@lezer/highlight'

/** Dark theme matching Readied's design */
const darkTheme = EditorView.theme({
  '&': {
    backgroundColor: 'transparent',
    color: '#f4f4f5',
    fontSize: '14px',
    height: '100%',
  },
  '.cm-content': {
    fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
    padding: '24px',
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
}, { dark: true })

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
  { tag: tags.monospace, fontFamily: "'JetBrains Mono', monospace", backgroundColor: 'rgba(255, 255, 255, 0.08)', padding: '2px 4px', borderRadius: '3px' },

  // Links
  { tag: tags.link, color: '#60a5fa', textDecoration: 'underline' },
  { tag: tags.url, color: '#60a5fa' },

  // Lists
  { tag: tags.list, color: '#a78bfa' },

  // Quotes
  { tag: tags.quote, color: 'rgba(255, 255, 255, 0.6)', fontStyle: 'italic', borderLeft: '3px solid rgba(94, 234, 212, 0.5)', paddingLeft: '12px' },

  // Meta (like --- for frontmatter)
  { tag: tags.meta, color: 'rgba(255, 255, 255, 0.4)' },
  { tag: tags.comment, color: 'rgba(255, 255, 255, 0.4)' },

  // Punctuation
  { tag: tags.processingInstruction, color: 'rgba(255, 255, 255, 0.4)' },
])

interface MarkdownEditorProps {
  initialContent: string
  onChange: (content: string) => void
  placeholder?: string
}

export function MarkdownEditor({ initialContent, onChange, placeholder = 'Start writing...' }: MarkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)

  // Keep onChange ref updated
  onChangeRef.current = onChange

  // Create extensions
  const createExtensions = useCallback((): Extension[] => {
    return [
      // Line numbers
      lineNumbers(),

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
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        indentWithTab,
      ]),

      // Markdown language with nested code highlighting
      markdown({
        base: markdownLanguage,
        codeLanguages: languages,
      }),

      // Syntax highlighting
      syntaxHighlighting(markdownHighlighting),

      // Dark theme
      darkTheme,

      // Placeholder
      EditorView.contentAttributes.of({ 'data-placeholder': placeholder }),

      // Update listener
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const content = update.state.doc.toString()
          onChangeRef.current(content)
        }
      }),
    ]
  }, [placeholder])

  // Initialize editor
  useEffect(() => {
    if (!containerRef.current) return

    const state = EditorState.create({
      doc: initialContent,
      extensions: createExtensions(),
    })

    const view = new EditorView({
      state,
      parent: containerRef.current,
    })

    viewRef.current = view

    // Focus the editor
    view.focus()

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, []) // Only run once on mount

  // Update content when initialContent changes (new note selected)
  useEffect(() => {
    const view = viewRef.current
    if (!view) return

    const currentContent = view.state.doc.toString()
    if (currentContent !== initialContent) {
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: initialContent,
        },
      })
    }
  }, [initialContent])

  return (
    <div
      ref={containerRef}
      className="markdown-editor"
    />
  )
}
