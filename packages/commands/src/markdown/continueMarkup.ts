/**
 * Enter continues the current Markdown list, task, or blockquote.
 * An empty item drops the marker (outdent / leave the block).
 * Fenced code falls through to the default newline.
 */

import { EditorSelection } from '@codemirror/state';
import { EditorView, type KeyBinding } from '@codemirror/view';

const LIST_RE = /^([ \t]*)([-*+]|\d+[.)])( \[[ xX]\])? (.*)$/;
const QUOTE_RE = /^(?: *>)+ ?/;

interface Fence {
  ch: '`' | '~';
  len: number;
}

function fenceAfterLine(line: string, fence: Fence | null): Fence | null {
  const m = line.match(/^( {0,3})(`{3,}|~{3,})(.*)$/);
  if (!m) return fence;
  const marker = m[2] ?? '';
  const ch = marker[0] as '`' | '~';
  const len = marker.length;
  const info = m[3] ?? '';
  if (!fence) {
    if (ch === '`' && info.includes('`')) return fence;
    return { ch, len };
  }
  if (fence.ch === ch && len >= fence.len && info.trim() === '') return null;
  return fence;
}

function lineIsInFence(doc: string, pos: number): boolean {
  const lines = doc.split('\n');
  const index = doc.slice(0, pos).split('\n').length - 1;
  let fence: Fence | null = null;
  for (let i = 0; i < lines.length; i++) {
    const inside = fence !== null;
    if (i === index) return inside;
    fence = fenceAfterLine(lines[i] ?? '', fence);
  }
  return false;
}

function nextOrderedMarker(marker: string): string {
  const n = parseInt(marker, 10);
  const delim = marker.slice(-1);
  return `${Number.isFinite(n) ? n + 1 : 1}${delim}`;
}

/**
 * Marker for a new sibling item. Tasks always continue unchecked.
 * `empty` means the current item has no text — Enter should outdent / leave.
 */
export function nextMarkupPrefix(line: string): { prefix: string; empty: boolean } | null {
  const quote = line.match(QUOTE_RE)?.[0] ?? '';
  const content = line.slice(quote.length);
  const list = content.match(LIST_RE);
  if (list) {
    const indent = list[1] ?? '';
    const marker = list[2] ?? '';
    const task = list[3];
    const rest = list[4] ?? '';
    const empty = rest.trim() === '';
    const ordered = /^\d+[.)]$/.test(marker);
    const next = ordered ? nextOrderedMarker(marker) : marker;
    const taskBit = task ? ' [ ]' : '';
    return { prefix: `${quote}${indent}${next}${taskBit} `, empty };
  }
  if (quote) {
    return { prefix: quote.endsWith(' ') ? quote : `${quote} `, empty: content.trim() === '' };
  }
  return null;
}

/** Empty item: nested list outdents two spaces; otherwise drop the marker. */
export function outdentMarkupLine(line: string): string {
  const quote = line.match(QUOTE_RE)?.[0] ?? '';
  const content = line.slice(quote.length);
  const list = content.match(LIST_RE);
  if (list) {
    const indent = list[1] ?? '';
    if (indent.length >= 2) {
      const marker = list[2] ?? '';
      const taskBit = list[3] ? ' [ ]' : '';
      return `${quote}${indent.slice(0, indent.length - 2)}${marker}${taskBit} `;
    }
    return quote;
  }
  return '';
}

function renumberFollowing(
  doc: string,
  fromLineNumber: number
): { from: number; to: number; insert: string }[] {
  const lines = doc.split('\n');
  const start = lines[fromLineNumber - 1];
  if (start == null) return [];
  const quote = start.match(QUOTE_RE)?.[0] ?? '';
  const content = start.slice(quote.length);
  const list = content.match(LIST_RE);
  if (!list || !/^\d+[.)]$/.test(list[2] ?? '')) return [];
  const indent = list[1] ?? '';
  const delim = (list[2] ?? '').slice(-1);
  let n = parseInt(list[2] ?? '1', 10);
  if (!Number.isFinite(n)) return [];
  const changes: { from: number; to: number; insert: string }[] = [];
  let offset = 0;
  for (let i = 0; i < fromLineNumber; i++) offset += (lines[i]?.length ?? 0) + 1;
  for (let i = fromLineNumber; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const q = line.match(QUOTE_RE)?.[0] ?? '';
    if (q !== quote) break;
    const c = line.slice(q.length);
    const m = c.match(LIST_RE);
    if (!m) {
      if (line.trim() === '') continue;
      break;
    }
    if ((m[1] ?? '') !== indent) {
      if ((m[1] ?? '').length > indent.length) continue;
      break;
    }
    if (!/^\d+[.)]$/.test(m[2] ?? '')) break;
    n += 1;
    const next = `${n}${delim}`;
    if (next !== m[2]) {
      const markerFrom = offset + q.length + (m[1]?.length ?? 0);
      changes.push({ from: markerFrom, to: markerFrom + (m[2]?.length ?? 0), insert: next });
    }
    offset += line.length + 1;
  }
  return changes;
}

/** Continue the list/quote on Enter. Returns false so a plain newline can run. */
export function continueMarkup(view: EditorView): boolean {
  const { state } = view;
  if (state.selection.ranges.some(range => !range.empty)) return false;
  const pos = state.selection.main.head;
  const doc = state.doc.toString();
  if (lineIsInFence(doc, pos)) return false;

  const line = state.doc.lineAt(pos);
  const parsed = nextMarkupPrefix(line.text);
  if (!parsed) return false;

  if (parsed.empty) {
    const kept = outdentMarkupLine(line.text);
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: kept },
      selection: EditorSelection.cursor(line.from + kept.length),
      userEvent: 'input',
    });
    return true;
  }

  const after = state.sliceDoc(pos, line.to);
  const insert = `\n${parsed.prefix}${after}`;
  const cursor = pos + 1 + parsed.prefix.length;
  let next = doc.slice(0, pos) + insert + doc.slice(line.to);
  const extras = renumberFollowing(next, line.number + 1);
  for (const change of [...extras].sort((a, b) => b.from - a.from)) {
    next = next.slice(0, change.from) + change.insert + next.slice(change.to);
  }
  view.dispatch({
    changes: { from: 0, to: doc.length, insert: next },
    selection: EditorSelection.cursor(cursor),
    userEvent: 'input',
  });
  return true;
}

export const continueMarkupKeymap: KeyBinding = {
  key: 'Enter',
  run: continueMarkup,
};
