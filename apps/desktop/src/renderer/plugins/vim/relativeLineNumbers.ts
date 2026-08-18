import { lineNumbers } from '@codemirror/view';
import type { EditorState } from '@codemirror/state';

/** Current line is absolute; others are distance from the cursor (vim `relativenumber`). */
export function formatRelativeLineNumber(lineNo: number, state: EditorState): string {
  if (lineNo > state.doc.lines) return '0';
  const cursorLine = state.doc.lineAt(state.selection.asSingle().ranges[0]!.to).number;
  if (lineNo === cursorLine) return String(cursorLine);
  return String(Math.abs(cursorLine - lineNo));
}

export const relativeLineNumbers = lineNumbers({
  formatNumber: formatRelativeLineNumber,
});
