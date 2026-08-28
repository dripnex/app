/** CommonMark fence opener: 0–3 spaces, then 3+ backticks or tildes. */
export const FENCE = /^( {0,3})(`{3,}|~{3,})/;

export interface SourceLine {
  line: string;
  from: number;
  to: number;
  nextFrom: number;
  inFence: boolean;
  isFenceOpener: boolean;
  isFenceCloser: boolean;
  next: string | null;
}

function fenceMarker(line: string): string | null {
  return line.match(FENCE)?.[2] ?? null;
}

/**
 * Walk markdown source with CRLF-aware offsets and CommonMark fence pairing.
 * A closer must use the same marker character and be at least as long as the opener.
 */
export function walkSourceLines(content: string): SourceLine[] {
  const rows: SourceLine[] = [];
  let i = 0;
  let fence: string | null = null;

  while (i < content.length || rows.length === 0) {
    const nl = content.indexOf('\n', i);
    const crlf = nl > 0 && content[nl - 1] === '\r';
    const lineEnd = nl === -1 ? content.length : crlf ? nl - 1 : nl;
    const line = content.slice(i, lineEnd);
    const nextFrom = nl === -1 ? content.length : nl + 1;
    const marker = fenceMarker(line);

    let isFenceOpener = false;
    let isFenceCloser = false;
    if (marker) {
      if (!fence) {
        fence = marker;
        isFenceOpener = true;
      } else if (marker[0] === fence[0] && marker.length >= fence.length) {
        isFenceCloser = true;
        fence = null;
      }
    }

    rows.push({
      line,
      from: i,
      to: lineEnd,
      nextFrom,
      inFence: Boolean(fence) || isFenceOpener || isFenceCloser,
      isFenceOpener,
      isFenceCloser,
      next: null,
    });

    if (nl === -1) break;
    i = nextFrom;
  }

  for (let k = 0; k < rows.length - 1; k++) {
    rows[k]!.next = rows[k + 1]!.line;
  }
  return rows;
}

/** Line containing `offset`. A newline belongs to the preceding line; the next line starts after it. */
export function lineAtOffset(content: string, offset: number): SourceLine | null {
  const clamped = Math.max(0, Math.min(offset, content.length));
  const rows = walkSourceLines(content);
  for (const row of rows) {
    if (clamped >= row.from && clamped < row.nextFrom) return row;
  }
  return rows[rows.length - 1] ?? null;
}

export function offsetInFence(content: string, offset: number): boolean {
  return lineAtOffset(content, offset)?.inFence ?? false;
}
