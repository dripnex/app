import type { ParsedTable, TableAlignment, TableRange } from './types.js';

const TABLE_SEP_RE = /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;

export function parseAlignment(cell: string): TableAlignment {
  const trimmed = cell.trim();
  const left = trimmed.startsWith(':');
  const right = trimmed.endsWith(':');
  if (left && right) return 'center';
  if (right) return 'right';
  if (left) return 'left';
  return 'none';
}

export function splitRow(line: string): string[] {
  let trimmed = line.trim();
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
  if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1);
  return trimmed.split('|').map(c => c.trim());
}

export function parseGfmTable(text: string, from: number): ParsedTable | null {
  const lines = text.split('\n');
  const headerLine = lines[0];
  const sepLine = lines[1];
  if (!headerLine || !sepLine) return null;
  if (!TABLE_SEP_RE.test(sepLine)) return null;

  const headers = splitRow(headerLine);
  const sepCells = splitRow(sepLine);
  if (headers.length !== sepCells.length) return null;

  const alignments = sepCells.map(parseAlignment);
  const rows: string[][] = [];

  for (let i = 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line) break;
    const trimmed = line.trim();
    if (!trimmed || !trimmed.includes('|')) break;
    const cells = splitRow(line);
    while (cells.length < headers.length) cells.push('');
    rows.push(cells.slice(0, headers.length));
  }

  return { headers, alignments, rows, from, to: from + text.length, text };
}

export function findTableRanges(docText: string): TableRange[] {
  const ranges: TableRange[] = [];
  const lines = docText.split('\n');
  let i = 0;

  while (i < lines.length) {
    const currentLine = lines[i]!;
    const nextLine = lines[i + 1];
    if (nextLine !== undefined && currentLine.trim().includes('|') && TABLE_SEP_RE.test(nextLine)) {
      const startLine = i;
      i += 2;
      while (i < lines.length && lines[i]!.trim().includes('|')) {
        i++;
      }

      let from = 0;
      for (let j = 0; j < startLine; j++) {
        from += lines[j]!.length + 1;
      }
      let to = from;
      for (let j = startLine; j < i; j++) {
        to += lines[j]!.length + (j < i - 1 ? 1 : 0);
      }

      ranges.push({ from, to, text: lines.slice(startLine, i).join('\n') });
    } else {
      i++;
    }
  }

  return ranges;
}

export function findTableAtCursor(content: string, pos: number): ParsedTable | null {
  for (const range of findTableRanges(content)) {
    if (pos >= range.from && pos <= range.to) {
      return parseGfmTable(range.text, range.from);
    }
  }
  return null;
}
