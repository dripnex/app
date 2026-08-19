import type { ParsedTable, TableAlignment } from './types.js';
import { findTableAtCursor, findTableRanges, parseGfmTable } from './parse.js';

/** Header is row 0; body starts at 1. */
export interface TableCellPos {
  table: ParsedTable;
  row: number;
  col: number;
}

export interface TableEdit {
  from: number;
  to: number;
  text: string;
  cursorFrom: number;
  cursorTo: number;
}

export type TableOp =
  | { type: 'nextCell' }
  | { type: 'prevCell' }
  | { type: 'nextRow' }
  | { type: 'move'; dRow: number; dCol: number }
  | { type: 'insertRow' }
  | { type: 'insertColumn' }
  | { type: 'deleteRow' }
  | { type: 'deleteColumn' }
  | { type: 'moveRow'; dir: -1 | 1 }
  | { type: 'moveColumn'; dir: -1 | 1 }
  | { type: 'align'; alignment: TableAlignment }
  | { type: 'format' }
  | { type: 'selectCell' }
  | { type: 'escape' };

function cloneTable(table: ParsedTable): ParsedTable {
  return {
    ...table,
    headers: [...table.headers],
    alignments: [...table.alignments],
    rows: table.rows.map(row => [...row]),
    text: table.text,
  };
}

function cellSpans(line: string): Array<{ start: number; end: number }> {
  const spans: Array<{ start: number; end: number }> = [];
  let i = line.startsWith('|') ? 1 : 0;
  while (i <= line.length) {
    const start = i;
    let j = i;
    while (j < line.length && line[j] !== '|') j += 1;
    if (j === start && j >= line.length) break;
    spans.push({ start, end: j });
    if (j >= line.length) break;
    i = j + 1;
  }
  if (spans.length > 1 && spans[spans.length - 1]!.start >= line.length) spans.pop();
  return spans;
}

function colAt(line: string, x: number): number {
  const spans = cellSpans(line);
  if (spans.length === 0) return 0;
  const clamped = Math.max(0, x);
  for (let i = 0; i < spans.length; i += 1) {
    const span = spans[i]!;
    if (clamped < span.end) return i;
  }
  return spans.length - 1;
}

export function locateCell(content: string, pos: number): TableCellPos | null {
  const table = findTableAtCursor(content, pos);
  if (!table) return null;
  const rel = Math.max(0, Math.min(pos, table.to) - table.from);
  const lines = table.text.split('\n');
  let offset = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    const next = offset + line.length + (i < lines.length - 1 ? 1 : 0);
    if (rel < next || i === lines.length - 1) {
      const col = colAt(line, rel - offset);
      if (i === 1) return { table, row: 0, col };
      const row = i === 0 ? 0 : i - 1;
      return { table, row, col };
    }
    offset = next;
  }
  return { table, row: 0, col: 0 };
}

function alignToken(alignment: TableAlignment): string {
  if (alignment === 'left') return ':---';
  if (alignment === 'right') return '---:';
  if (alignment === 'center') return ':---:';
  return '---';
}

function padCell(value: string, width: number, alignment: TableAlignment): string {
  const text = value.trim();
  const extra = Math.max(0, width - text.length);
  if (alignment === 'right') return `${' '.repeat(extra)}${text}`;
  if (alignment === 'center') {
    const left = Math.floor(extra / 2);
    return `${' '.repeat(left)}${text}${' '.repeat(extra - left)}`;
  }
  return `${text}${' '.repeat(extra)}`;
}

export function serializeGfmTable(table: ParsedTable, pretty = false): string {
  const cols = table.headers.length;
  const widths = Array.from({ length: cols }, (_, i) => {
    const header = table.headers[i]?.trim().length ?? 0;
    const body = table.rows.reduce((max, row) => Math.max(max, row[i]?.trim().length ?? 0), 0);
    const align = alignToken(table.alignments[i] ?? 'none').length;
    return Math.max(3, header, body, pretty ? align : 3);
  });

  const pipe = (cells: string[], alignments?: TableAlignment[]): string => {
    const inner = cells.map((cell, i) => {
      const value = pretty
        ? padCell(cell, widths[i] ?? 3, alignments?.[i] ?? table.alignments[i] ?? 'none')
        : cell.trim();
      return ` ${value} `;
    });
    return `|${inner.join('|')}|`;
  };

  const sep = table.alignments.map((alignment, i) => {
    const token = alignToken(alignment);
    if (!pretty) return ` ${token} `;
    const width = widths[i] ?? 3;
    if (alignment === 'left') return ` :${'-'.repeat(Math.max(1, width - 1))} `;
    if (alignment === 'right') return ` ${'-'.repeat(Math.max(1, width - 1))}: `;
    if (alignment === 'center') return ` :${'-'.repeat(Math.max(1, width - 2))}: `;
    return ` ${'-'.repeat(width)} `;
  });

  return [pipe(table.headers), `|${sep.join('|')}|`, ...table.rows.map(row => pipe(row))].join(
    '\n'
  );
}

function emptyRow(cols: number): string[] {
  return Array.from({ length: cols }, () => '');
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lastRow(table: ParsedTable): number {
  return table.rows.length;
}

function lastCol(table: ParsedTable): number {
  return Math.max(0, table.headers.length - 1);
}

function cellSelection(
  serialized: string,
  tableFrom: number,
  row: number,
  col: number
): {
  from: number;
  to: number;
} {
  const lines = serialized.split('\n');
  const lineIndex = row === 0 ? 0 : row + 1;
  let offset = tableFrom;
  for (let i = 0; i < lineIndex; i += 1) {
    offset += (lines[i]?.length ?? 0) + 1;
  }
  const line = lines[lineIndex] ?? '';
  const spans = cellSpans(line);
  const span = spans[clamp(col, 0, Math.max(0, spans.length - 1))];
  if (!span) return { from: offset, to: offset };
  const raw = line.slice(span.start, span.end);
  const trimStart = raw.length - raw.trimStart().length;
  const trimEnd = raw.length - raw.trimEnd().length;
  const from = offset + span.start + trimStart;
  const to = offset + span.end - trimEnd;
  if (to <= from) {
    const mid = offset + Math.min(span.end - 1, span.start + Math.max(1, trimStart));
    return { from: mid, to: mid };
  }
  return { from, to };
}

export function applyTableOp(content: string, pos: number, op: TableOp): TableEdit | null {
  const located = locateCell(content, pos);
  if (!located) return null;

  const table = cloneTable(located.table);
  let row = clamp(located.row, 0, lastRow(table));
  let col = clamp(located.col, 0, lastCol(table));
  let pretty = false;
  let select = op.type === 'selectCell';

  if (op.type === 'escape') {
    const cursor = table.to + (content[table.to] === '\n' ? 1 : 0);
    return {
      from: table.from,
      to: table.to,
      text: table.text,
      cursorFrom: cursor,
      cursorTo: cursor,
    };
  }

  if (op.type === 'nextCell') {
    if (col < lastCol(table)) col += 1;
    else if (row < lastRow(table)) {
      row += 1;
      col = 0;
    } else {
      table.rows.push(emptyRow(table.headers.length));
      row += 1;
      col = 0;
    }
    select = true;
  } else if (op.type === 'prevCell') {
    if (col > 0) col -= 1;
    else if (row > 0) {
      row -= 1;
      col = lastCol(table);
    }
    select = true;
  } else if (op.type === 'nextRow') {
    if (row < lastRow(table)) row += 1;
    else {
      table.rows.push(emptyRow(table.headers.length));
      row += 1;
    }
    select = true;
  } else if (op.type === 'move') {
    row = clamp(row + op.dRow, 0, lastRow(table));
    col = clamp(col + op.dCol, 0, lastCol(table));
    select = true;
  } else if (op.type === 'insertRow') {
    if (row === 0) {
      table.rows.splice(0, 0, emptyRow(table.headers.length));
      row = 1;
    } else {
      table.rows.splice(row, 0, emptyRow(table.headers.length));
      row += 1;
    }
    select = true;
  } else if (op.type === 'insertColumn') {
    const at = col + 1;
    table.headers.splice(at, 0, '');
    table.alignments.splice(at, 0, 'none');
    for (const body of table.rows) body.splice(at, 0, '');
    col = at;
    select = true;
  } else if (op.type === 'deleteRow') {
    if (row === 0 || table.rows.length === 0) return null;
    table.rows.splice(row - 1, 1);
    row = clamp(row, 0, lastRow(table));
    select = true;
  } else if (op.type === 'deleteColumn') {
    if (table.headers.length <= 1) return null;
    table.headers.splice(col, 1);
    table.alignments.splice(col, 1);
    for (const body of table.rows) body.splice(col, 1);
    col = clamp(col, 0, lastCol(table));
    select = true;
  } else if (op.type === 'moveRow') {
    if (row === 0) return null;
    const from = row - 1;
    const to = from + op.dir;
    if (to < 0 || to >= table.rows.length) return null;
    const swap = table.rows[from]!;
    table.rows[from] = table.rows[to]!;
    table.rows[to] = swap;
    row = to + 1;
    select = true;
  } else if (op.type === 'moveColumn') {
    const to = col + op.dir;
    if (to < 0 || to >= table.headers.length) return null;
    const swap = <T>(arr: T[]) => {
      const tmp = arr[col]!;
      arr[col] = arr[to]!;
      arr[to] = tmp;
    };
    swap(table.headers);
    swap(table.alignments);
    for (const body of table.rows) swap(body);
    col = to;
    select = true;
  } else if (op.type === 'align') {
    table.alignments[col] = op.alignment;
    pretty = true;
  } else if (op.type === 'format') {
    pretty = true;
  } else if (op.type === 'selectCell') {
    select = true;
  }

  const text = serializeGfmTable(table, pretty);
  const selection = cellSelection(text, table.from, row, col);

  return {
    from: table.from,
    to: table.to,
    text,
    cursorFrom: selection.from,
    cursorTo: select ? selection.to : selection.from,
  };
}

export function formatAllTables(content: string): string {
  const ranges = findTableRanges(content);
  let next = content;
  for (let i = ranges.length - 1; i >= 0; i -= 1) {
    const range = ranges[i]!;
    const parsed = parseGfmTable(range.text, range.from);
    if (!parsed) continue;
    const text = serializeGfmTable(parsed, true);
    next = next.slice(0, range.from) + text + next.slice(range.to);
  }
  return next;
}
