/**
 * Smart Markdown list indent — Inkdrop v6.1 behavior.
 *
 * Tab indents a list item by the marker width of the item above it
 * (`-` → 2, `1.` → 3, `10.` → 4). Shift-Tab reverses. Numbered lists
 * in the same region are renumbered in the same change.
 */

import { EditorView, type KeyBinding } from '@codemirror/view';

export type ListKind = 'bullet' | 'ordered';

export interface ParsedListLine {
  indent: number;
  bullet: string;
  delimiter: '.' | ')' | '';
  number: number | null;
  task: string;
  rest: string;
  markerWidth: number;
  kind: ListKind;
}

const LIST_RE = /^([ \t]*)([-*+]|\d+[.)])( \[[ xX]\])? (.*)$/;

export function visualCols(ws: string): number {
  let cols = 0;
  for (const ch of ws) {
    if (ch === '\t') cols += 4 - (cols % 4);
    else cols += 1;
  }
  return cols;
}

export function leadingWs(line: string): string {
  const m = line.match(/^[ \t]*/);
  return m?.[0] ?? '';
}

export function parseListLine(line: string): ParsedListLine | null {
  const m = line.match(LIST_RE);
  if (!m) return null;
  const rawMarker = m[2] ?? '';
  const ordered = /^\d+[.)]$/.test(rawMarker);
  return {
    indent: visualCols(m[1] ?? ''),
    bullet: ordered ? '' : rawMarker,
    delimiter: ordered ? (rawMarker.slice(-1) as '.' | ')') : '',
    number: ordered ? parseInt(rawMarker, 10) : null,
    task: m[3] ?? '',
    rest: m[4] ?? '',
    markerWidth: rawMarker.length + 1,
    kind: ordered ? 'ordered' : 'bullet',
  };
}

export function formatListLine(
  parsed: ParsedListLine,
  indent: number,
  number: number | null = parsed.number
): string {
  const mark = parsed.kind === 'ordered' ? `${number ?? 1}${parsed.delimiter}` : parsed.bullet;
  return `${' '.repeat(Math.max(0, indent))}${mark}${parsed.task} ${parsed.rest}`;
}

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

/** True when the line is inside a fenced code block (not the opening fence). */
export function fencesByLine(lines: readonly string[]): boolean[] {
  const inside: boolean[] = [];
  let fence: Fence | null = null;
  for (const line of lines) {
    inside.push(fence !== null);
    fence = fenceAfterLine(line, fence);
  }
  return inside;
}

function findPrevList(
  parsed: readonly (ParsedListLine | null)[],
  index: number,
  maxIndent: number
): ParsedListLine | null {
  for (let i = index - 1; i >= 0; i--) {
    const prev = parsed[i];
    if (!prev) continue;
    if (prev.indent <= maxIndent) return prev;
  }
  return null;
}

function isSelectedAncestor(
  parsed: readonly (ParsedListLine | null)[],
  index: number,
  selected: ReadonlySet<number>
): boolean {
  const current = parsed[index];
  if (!current) return false;
  let indent = current.indent;
  for (let j = index - 1; j >= 0; j--) {
    const prev = parsed[j];
    if (!prev) continue;
    if (prev.indent < indent) {
      if (selected.has(j)) return true;
      indent = prev.indent;
    }
  }
  return false;
}

function renumberLists(lines: string[], moved: ReadonlySet<number>): string[] {
  const inside = fencesByLine(lines);
  const out = lines.slice();
  const stack: { indent: number; next: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (inside[i]) {
      stack.length = 0;
      continue;
    }
    const parsed = parseListLine(lines[i] ?? '');
    if (!parsed) {
      if ((lines[i] ?? '').trim() === '') continue;
      if (visualCols(leadingWs(lines[i] ?? '')) > (stack.at(-1)?.indent ?? -1)) continue;
      stack.length = 0;
      continue;
    }

    while (stack.length > 0 && stack[stack.length - 1]!.indent > parsed.indent) {
      stack.pop();
    }

    if (parsed.kind === 'ordered') {
      const top = stack.at(-1);
      let n: number;
      if (top && top.indent === parsed.indent) {
        n = top.next;
        top.next = n + 1;
      } else {
        // A newly nested list starts at 1; an unmoved run keeps its start number.
        n = moved.has(i) ? 1 : (parsed.number ?? 1);
        stack.push({ indent: parsed.indent, next: n + 1 });
      }
      if (n !== parsed.number) {
        out[i] = formatListLine(parsed, parsed.indent, n);
      }
    } else {
      const top = stack.at(-1);
      if (top && top.indent === parsed.indent) stack.pop();
      stack.push({ indent: parsed.indent, next: 1 });
    }
  }

  return out;
}

/** Smallest from/to/insert so the cursor stays on the same characters. */
export function minimalLineChange(
  lineFrom: number,
  oldText: string,
  newText: string
): { from: number; to: number; insert: string } {
  let suffix = 0;
  const maxSuffix = Math.min(oldText.length, newText.length);
  while (
    suffix < maxSuffix &&
    oldText[oldText.length - 1 - suffix] === newText[newText.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  const oldPrefixLen = oldText.length - suffix;
  const newPrefixLen = newText.length - suffix;
  let prefix = 0;
  while (prefix < oldPrefixLen && prefix < newPrefixLen && oldText[prefix] === newText[prefix]) {
    prefix += 1;
  }
  return {
    from: lineFrom + prefix,
    to: lineFrom + oldPrefixLen,
    insert: newText.slice(prefix, newPrefixLen),
  };
}

/**
 * Indent (`direction = 1`) or dedent (`direction = -1`) list items on the
 * given 1-based line numbers. Returns new lines, or null when Tab/Shift-Tab
 * should fall through to ordinary indent.
 */
export function indentList(
  doc: string,
  lineNumbers: readonly number[],
  direction: 1 | -1
): string[] | null {
  const lines = doc.split('\n');
  const inside = fencesByLine(lines);
  const parsed = lines.map((line, i) => (inside[i] ? null : parseListLine(line)));

  const selected = new Set(lineNumbers.filter(n => n >= 1 && n <= lines.length).map(n => n - 1));
  const selectedItems = [...selected].filter(i => parsed[i] != null).sort((a, b) => a - b);
  if (selectedItems.length === 0) return null;

  const roots = selectedItems.filter(i => !isSelectedAncestor(parsed, i, selected));

  const nextIndent = new Map<number, number>();
  const nextCols = new Map<number, number>();

  for (const i of roots) {
    const item = parsed[i];
    if (!item) continue;

    let next: number;
    if (direction === 1) {
      const above = findPrevList(parsed, i, item.indent);
      next = item.indent + (above?.markerWidth ?? item.markerWidth);
    } else {
      const parent = findPrevList(parsed, i, item.indent - 1);
      if (parent) next = parent.indent;
      else if (item.indent > 0) next = 0;
      else continue;
    }
    const delta = next - item.indent;
    nextIndent.set(i, next);

    for (let j = i + 1; j < lines.length; j++) {
      const child = parsed[j];
      if (child) {
        if (child.indent <= item.indent) break;
        nextIndent.set(j, Math.max(0, child.indent + delta));
        continue;
      }
      const line = lines[j] ?? '';
      if (line.trim() === '') continue;
      const cols = visualCols(leadingWs(line));
      if (cols > item.indent) {
        nextCols.set(j, Math.max(0, cols + delta));
      } else {
        break;
      }
    }
  }

  if (nextIndent.size === 0 && nextCols.size === 0) return null;

  const out = lines.slice();
  for (const [i, indent] of nextIndent) {
    const item = parsed[i];
    if (item) out[i] = formatListLine(item, indent, item.number ?? 1);
  }
  for (const [i, cols] of nextCols) {
    const line = lines[i] ?? '';
    const ws = leadingWs(line);
    out[i] = `${' '.repeat(cols)}${line.slice(ws.length)}`;
  }

  return renumberLists(out, new Set(nextIndent.keys()));
}

function applyListIndent(view: EditorView, direction: 1 | -1): boolean {
  const { state } = view;
  const lineNumbers: number[] = [];
  for (const range of state.selection.ranges) {
    const fromLine = state.doc.lineAt(range.from).number;
    const toLine = state.doc.lineAt(range.to).number;
    for (let n = fromLine; n <= toLine; n++) lineNumbers.push(n);
  }

  const next = indentList(state.doc.toString(), lineNumbers, direction);
  if (!next) return false;

  const changes: { from: number; to: number; insert: string }[] = [];
  for (let n = 1; n <= state.doc.lines; n++) {
    const line = state.doc.line(n);
    const text = next[n - 1] ?? '';
    if (text !== line.text) {
      changes.push(minimalLineChange(line.from, line.text, text));
    }
  }
  if (changes.length === 0) return false;

  view.dispatch({
    changes,
    userEvent: direction === 1 ? 'indent' : 'dedent',
  });
  return true;
}

/** Tab: nest the list item under the one above. */
export function indentListItem(view: EditorView): boolean {
  return applyListIndent(view, 1);
}

/** Shift-Tab: lift the list item one level. */
export function dedentListItem(view: EditorView): boolean {
  return applyListIndent(view, -1);
}

/** Keymap binding. Put before `indentWithTab` so lists win, then fall through. */
export const listIndentKeymap: KeyBinding = {
  key: 'Tab',
  run: indentListItem,
  shift: dedentListItem,
};
