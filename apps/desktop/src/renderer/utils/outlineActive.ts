/** Last heading whose source line is at or above `line` (1-indexed). */
export function headingIndexAtOrBefore(
  headings: readonly { line: number }[],
  line: number
): number {
  let index = -1;
  for (let i = 0; i < headings.length; i += 1) {
    const heading = headings[i];
    if (heading && heading.line <= line) index = i;
    else break;
  }
  return index;
}

/** First heading whose text matches, else -1. */
export function headingIndexByText(
  headings: readonly { text: string }[],
  text: string | null
): number {
  if (!text) return -1;
  return headings.findIndex(heading => heading.text === text);
}
