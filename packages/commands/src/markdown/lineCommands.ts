/**
 * Line/selection commands matching Inkdrop v6.1 `editor:*` names.
 * CodeMirror already ships copy/move/select-line; this file is the rest.
 */

import { EditorSelection, type ChangeSpec } from '@codemirror/state';
import { EditorView, type KeyBinding } from '@codemirror/view';
import {
  cursorSubwordBackward,
  cursorSubwordForward,
  selectSubwordBackward,
  selectSubwordForward,
} from '@codemirror/commands';

const WORD = /[A-Za-z0-9_]/;

export function wordRangeAt(
  doc: { lineAt: (pos: number) => { from: number; text: string } },
  pos: number
): { from: number; to: number } {
  const line = doc.lineAt(pos);
  const offset = pos - line.from;
  let start = offset;
  let end = offset;
  while (start > 0 && WORD.test(line.text[start - 1] ?? '')) start -= 1;
  while (end < line.text.length && WORD.test(line.text[end] ?? '')) end += 1;
  return { from: line.from + start, to: line.from + end };
}

function queryAt(view: EditorView): { from: number; to: number; text: string } | null {
  const { state } = view;
  const range = state.selection.main;
  if (!range.empty) {
    return { from: range.from, to: range.to, text: state.sliceDoc(range.from, range.to) };
  }
  const word = wordRangeAt(state.doc, range.head);
  if (word.from === word.to) return null;
  return { from: word.from, to: word.to, text: state.sliceDoc(word.from, word.to) };
}

function indexOfFrom(haystack: string, needle: string, from: number, reverse: boolean): number {
  if (!needle) return -1;
  if (!reverse) {
    const hit = haystack.indexOf(needle, from);
    if (hit !== -1) return hit;
    return haystack.indexOf(needle);
  }
  const before = from > 0 ? haystack.lastIndexOf(needle, from - 1) : -1;
  if (before !== -1) return before;
  return haystack.lastIndexOf(needle);
}

/** Select the next occurrence of the selection (or the word at the cursor). */
export function findUnder(view: EditorView): boolean {
  return findUnderDir(view, false);
}

export function findUnderPrevious(view: EditorView): boolean {
  return findUnderDir(view, true);
}

function findUnderDir(view: EditorView, reverse: boolean): boolean {
  const q = queryAt(view);
  if (!q || !q.text) return false;
  const range = view.state.selection.main;
  const doc = view.state.doc.toString();
  const hit = indexOfFrom(doc, q.text, reverse ? q.from : q.to, reverse);
  if (hit === -1) return false;
  if (hit === q.from && !range.empty) return false;
  view.dispatch({
    selection: EditorSelection.range(hit, hit + q.text.length),
    scrollIntoView: true,
  });
  return true;
}

/**
 * Empty selection expands to the word. Otherwise jump to the next hit
 * and drop the current range.
 */
export function skipAndSelectNextOccurrence(view: EditorView): boolean {
  const { state } = view;
  const range = state.selection.main;
  if (range.empty) {
    const word = wordRangeAt(state.doc, range.head);
    if (word.from === word.to) return false;
    view.dispatch({
      selection: EditorSelection.range(word.from, word.to),
      scrollIntoView: true,
    });
    return true;
  }
  return findUnder(view);
}

export function splitSelectionByLine(view: EditorView): boolean {
  const { state } = view;
  const ranges = [];
  for (const range of state.selection.ranges) {
    const fromLine = state.doc.lineAt(range.from);
    let toLine = state.doc.lineAt(range.to);
    if (!range.empty && toLine.from === range.to) {
      toLine = state.doc.line(toLine.number - 1);
    }
    for (let n = fromLine.number; n <= toLine.number; n++) {
      const line = state.doc.line(n);
      const from = n === fromLine.number ? range.from : line.from;
      const to = n === toLine.number ? range.to : line.to;
      ranges.push(EditorSelection.range(from, to));
    }
  }
  if (ranges.length === state.selection.ranges.length && ranges.length === 1) return false;
  view.dispatch({ selection: EditorSelection.create(ranges) });
  return true;
}

export function joinLines(view: EditorView): boolean {
  const { state } = view;
  const changes: ChangeSpec[] = [];
  const cursors: { from: number }[] = [];
  let shift = 0;
  for (const range of state.selection.ranges) {
    const startLine = state.doc.lineAt(range.from);
    let endLine = range.empty ? startLine : state.doc.lineAt(range.to);
    if (range.empty || endLine.number === startLine.number) {
      if (startLine.number === state.doc.lines) continue;
      endLine = state.doc.line(startLine.number + 1);
    } else if (endLine.from === range.to && range.to > range.from) {
      endLine = state.doc.line(endLine.number - 1);
    }
    if (endLine.number <= startLine.number) continue;
    const parts: string[] = [];
    for (let n = startLine.number; n <= endLine.number; n++) {
      let text = state.doc.line(n).text;
      if (n > startLine.number) text = text.replace(/^[ \t]+/, '');
      parts.push(text);
    }
    const joined = parts.join(' ');
    changes.push({ from: startLine.from, to: endLine.to, insert: joined });
    cursors.push({ from: startLine.from + shift + joined.length });
    shift += joined.length - (endLine.to - startLine.from);
  }
  if (changes.length === 0) return false;
  view.dispatch({
    changes,
    selection: EditorSelection.create(cursors.map(c => EditorSelection.cursor(c.from))),
    userEvent: 'join',
  });
  return true;
}

function sortRanges(
  view: EditorView,
  compare: (a: string, b: string) => number,
  reverse: boolean
): boolean {
  const { state } = view;
  const changes: ChangeSpec[] = [];
  for (const range of state.selection.ranges) {
    if (range.empty) continue;
    const fromLine = state.doc.lineAt(range.from);
    let toLine = state.doc.lineAt(range.to);
    if (toLine.from === range.to && range.to > range.from) {
      toLine = state.doc.line(toLine.number - 1);
    }
    if (toLine.number - fromLine.number < 1) continue;
    const lines: string[] = [];
    for (let n = fromLine.number; n <= toLine.number; n++) {
      lines.push(state.doc.line(n).text);
    }
    const sorted = [...lines].sort(compare);
    if (reverse) sorted.reverse();
    if (sorted.every((line, i) => line === lines[i])) continue;
    changes.push({ from: fromLine.from, to: toLine.to, insert: sorted.join('\n') });
  }
  if (changes.length === 0) return false;
  view.dispatch({ changes, userEvent: 'sort' });
  return true;
}

const cmpSensitive = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const cmpInsensitive = (a: string, b: string) => {
  const c = a.toLowerCase().localeCompare(b.toLowerCase());
  return c !== 0 ? c : cmpSensitive(a, b);
};

export function sortLines(view: EditorView): boolean {
  return sortRanges(view, cmpSensitive, false);
}
export function reverseSortLines(view: EditorView): boolean {
  return sortRanges(view, cmpSensitive, true);
}
export function sortLinesInsensitive(view: EditorView): boolean {
  return sortRanges(view, cmpInsensitive, false);
}
export function reverseSortLinesInsensitive(view: EditorView): boolean {
  return sortRanges(view, cmpInsensitive, true);
}

export function insertLineBefore(view: EditorView): boolean {
  const { state } = view;
  const changes: ChangeSpec[] = [];
  const cursors: number[] = [];
  let shift = 0;
  const seen = new Set<number>();
  for (const range of state.selection.ranges) {
    const line = state.doc.lineAt(range.head);
    if (seen.has(line.from)) continue;
    seen.add(line.from);
    const indent = line.text.match(/^[ \t]*/)?.[0] ?? '';
    const insert = `${indent}\n`;
    changes.push({ from: line.from, insert });
    cursors.push(line.from + shift + indent.length);
    shift += insert.length;
  }
  if (changes.length === 0) return false;
  view.dispatch({
    changes,
    selection: EditorSelection.create(cursors.map(pos => EditorSelection.cursor(pos))),
    userEvent: 'input',
  });
  return true;
}

function changeCase(view: EditorView, fn: (s: string) => string): boolean {
  const { state } = view;
  const changes: ChangeSpec[] = [];
  for (const range of state.selection.ranges) {
    let from = range.from;
    let to = range.to;
    if (from === to) {
      const word = wordRangeAt(state.doc, from);
      from = word.from;
      to = word.to;
    }
    if (from === to) continue;
    const next = fn(state.sliceDoc(from, to));
    if (next === state.sliceDoc(from, to)) continue;
    changes.push({ from, to, insert: next });
  }
  if (changes.length === 0) return false;
  view.dispatch({ changes, userEvent: 'input' });
  return true;
}

export function upcaseAtCursor(view: EditorView): boolean {
  return changeCase(view, s => s.toUpperCase());
}
export function downcaseAtCursor(view: EditorView): boolean {
  return changeCase(view, s => s.toLowerCase());
}

export function scrollLineUp(view: EditorView): boolean {
  const line = view.defaultLineHeight || 16;
  view.scrollDOM.scrollTop = Math.max(0, view.scrollDOM.scrollTop - line);
  return true;
}

export function scrollLineDown(view: EditorView): boolean {
  const line = view.defaultLineHeight || 16;
  view.scrollDOM.scrollTop += line;
  return true;
}

export function showInCenter(view: EditorView): boolean {
  view.dispatch({
    effects: EditorView.scrollIntoView(view.state.selection.main.head, { y: 'center' }),
  });
  return true;
}

export const editorLineKeymap: KeyBinding[] = [
  { key: 'F5', run: sortLinesInsensitive },
  { key: 'Shift-F5', run: reverseSortLinesInsensitive },
  { key: 'F9', run: sortLinesInsensitive },
  { key: 'Shift-F9', run: reverseSortLinesInsensitive },
  { key: 'Ctrl-F5', run: sortLines },
  { key: 'Shift-Ctrl-F5', run: reverseSortLines },
  { key: 'Ctrl-F9', run: sortLines },
  { key: 'Shift-Ctrl-F9', run: reverseSortLines },
  { key: 'Ctrl-j', run: joinLines },
  { key: 'Ctrl-Shift-j', run: joinLines },
  { key: 'Ctrl-Alt-ArrowLeft', run: cursorSubwordBackward },
  { key: 'Ctrl-Alt-ArrowRight', run: cursorSubwordForward },
  { key: 'Shift-Ctrl-Alt-ArrowLeft', run: selectSubwordBackward },
  { key: 'Shift-Ctrl-Alt-ArrowRight', run: selectSubwordForward },
  { key: 'Ctrl-PageUp', run: scrollLineUp },
  { key: 'Ctrl-PageDown', run: scrollLineDown },
  { win: 'Ctrl-ArrowUp', linux: 'Ctrl-ArrowUp', run: scrollLineUp },
  { win: 'Ctrl-ArrowDown', linux: 'Ctrl-ArrowDown', run: scrollLineDown },
];
