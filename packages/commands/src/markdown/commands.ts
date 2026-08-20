/**
 * Markdown Editing Commands
 *
 * Pure functions for markdown formatting operations.
 * All functions take an EditorView and dispatch changes.
 */

import { EditorView } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';
import { undo, redo } from '@codemirror/commands';

/**
 * Wrap selected text with markers (e.g., **bold**, *italic*)
 * If no selection, insert markers and place cursor between them
 */
function wrapSelection(view: EditorView, before: string, after: string): void {
  const { state } = view;
  const { from, to } = state.selection.main;
  const selectedText = state.sliceDoc(from, to);

  // Check if already wrapped - if so, unwrap
  const textBefore = state.sliceDoc(Math.max(0, from - before.length), from);
  const textAfter = state.sliceDoc(to, Math.min(state.doc.length, to + after.length));

  if (textBefore === before && textAfter === after) {
    // Unwrap
    view.dispatch({
      changes: [
        { from: from - before.length, to: from, insert: '' },
        { from: to, to: to + after.length, insert: '' },
      ],
      selection: EditorSelection.range(from - before.length, to - before.length),
    });
    return;
  }

  // Wrap
  const newText = `${before}${selectedText}${after}`;
  view.dispatch({
    changes: { from, to, insert: newText },
    selection:
      from === to
        ? EditorSelection.cursor(from + before.length) // No selection: cursor between markers
        : EditorSelection.range(from + before.length, to + before.length), // Keep selection
  });
  view.focus();
}

/**
 * Insert text at cursor or replace selection
 */
function insertText(view: EditorView, text: string, cursorOffset?: number): void {
  const { state } = view;
  const { from, to } = state.selection.main;

  view.dispatch({
    changes: { from, to, insert: text },
    selection: EditorSelection.cursor(from + (cursorOffset ?? text.length)),
  });
  view.focus();
}

/**
 * Insert prefix at start of current line(s)
 */
function insertLinePrefix(view: EditorView, prefix: string): void {
  const { state } = view;
  const { from, to } = state.selection.main;

  const startLine = state.doc.lineAt(from);
  const endLine = state.doc.lineAt(to);

  const changes: { from: number; to: number; insert: string }[] = [];

  for (let i = startLine.number; i <= endLine.number; i++) {
    const line = state.doc.line(i);
    changes.push({
      from: line.from,
      to: line.from,
      insert: prefix,
    });
  }

  view.dispatch({ changes });
  view.focus();
}

// ============================================================================
// Exported Commands
// ============================================================================

/** Toggle bold: **text** */
export function toggleBold(view: EditorView): void {
  wrapSelection(view, '**', '**');
}

/** Toggle italic: *text* */
export function toggleItalic(view: EditorView): void {
  wrapSelection(view, '*', '*');
}

/** Toggle strikethrough: ~~text~~ */
export function toggleStrikethrough(view: EditorView): void {
  wrapSelection(view, '~~', '~~');
}

/** Toggle inline code: `code` */
export function toggleInlineCode(view: EditorView): void {
  wrapSelection(view, '`', '`');
}

/** Insert link: [text](url) */
export function insertLink(view: EditorView): void {
  const { state } = view;
  const { from, to } = state.selection.main;
  const selectedText = state.sliceDoc(from, to);

  if (selectedText) {
    // Wrap selection as link text
    const newText = `[${selectedText}](url)`;
    view.dispatch({
      changes: { from, to, insert: newText },
      selection: EditorSelection.range(
        from + selectedText.length + 3,
        from + selectedText.length + 6
      ),
    });
  } else {
    // Insert empty link template
    insertText(view, '[](url)', 1);
  }
  view.focus();
}

export type GithubAlertKind = 'NOTE' | 'TIP' | 'IMPORTANT' | 'WARNING' | 'CAUTION';

/** Wrap the current selection (or insert) as a GitHub alert. */
export function insertGithubAlert(view: EditorView, kind: GithubAlertKind = 'NOTE'): void {
  const { state } = view;
  const { from, to } = state.selection.main;
  const selected = state.sliceDoc(from, to);
  const body = selected
    ? selected
        .split('\n')
        .map(line => `> ${line}`)
        .join('\n')
    : '> ';
  const text = `> [!${kind}]\n${body}`;
  view.dispatch({
    changes: { from, to, insert: text },
    selection: EditorSelection.cursor(from + text.length),
  });
  view.focus();
}

/** Insert heading at current line */
export function insertHeading(view: EditorView, level: 1 | 2 | 3 | 4 | 5 | 6 = 2): void {
  const { state } = view;
  const { from } = state.selection.main;
  const line = state.doc.lineAt(from);

  // Check if line already has a heading
  const lineText = line.text;
  const headingMatch = lineText.match(/^(#{1,6})\s/);

  if (headingMatch) {
    // Remove existing heading
    view.dispatch({
      changes: {
        from: line.from,
        to: line.from + headingMatch[0].length,
        insert: '',
      },
    });
  } else {
    // Add heading
    const prefix = '#'.repeat(level) + ' ';
    view.dispatch({
      changes: { from: line.from, to: line.from, insert: prefix },
    });
  }
  view.focus();
}

/** Insert unordered list: - item */
export function insertUnorderedList(view: EditorView): void {
  insertLinePrefix(view, '- ');
}

/** Insert ordered list: 1. item */
export function insertOrderedList(view: EditorView): void {
  const { state } = view;
  const { from, to } = state.selection.main;

  const startLine = state.doc.lineAt(from);
  const endLine = state.doc.lineAt(to);

  const changes: { from: number; to: number; insert: string }[] = [];
  let number = 1;

  for (let i = startLine.number; i <= endLine.number; i++) {
    const line = state.doc.line(i);
    changes.push({
      from: line.from,
      to: line.from,
      insert: `${number}. `,
    });
    number++;
  }

  view.dispatch({ changes });
  view.focus();
}

/** Insert checkbox: - [ ] item */
export function insertCheckbox(view: EditorView): void {
  insertLinePrefix(view, '- [ ] ');
}

/** Insert blockquote: > text */
export function insertQuote(view: EditorView): void {
  insertLinePrefix(view, '> ');
}

/** Insert code block */
export function insertCodeBlock(view: EditorView): void {
  const { state } = view;
  const { from, to } = state.selection.main;
  const selectedText = state.sliceDoc(from, to);

  const codeBlock = selectedText ? `\`\`\`\n${selectedText}\n\`\`\`` : '```\n\n```';

  view.dispatch({
    changes: { from, to, insert: codeBlock },
    selection: EditorSelection.cursor(from + 4), // After ```\n
  });
  view.focus();
}

/** Insert horizontal rule: --- */
export function insertHorizontalRule(view: EditorView): void {
  const { state } = view;
  const { from } = state.selection.main;
  const line = state.doc.lineAt(from);

  // Insert at end of current line with newlines
  view.dispatch({
    changes: { from: line.to, to: line.to, insert: '\n\n---\n\n' },
    selection: EditorSelection.cursor(line.to + 7),
  });
  view.focus();
}

/** Undo last change */
export function undoChange(view: EditorView): void {
  undo(view);
  view.focus();
}

/** Redo last undone change */
export function redoChange(view: EditorView): void {
  redo(view);
  view.focus();
}
