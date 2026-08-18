export type UrlPasteFormat = 'plain' | 'angle' | 'markdown';

export function isBareHttpUrl(text: string): boolean {
  return /^https?:\/\/\S+$/i.test(text.trim());
}

/** Cursor is inside `[…]` or `(…)` of a Markdown link. */
export function isInsideMarkdownLink(lineText: string, offset: number): boolean {
  const before = lineText.slice(0, Math.max(0, offset));
  const openBracket = before.lastIndexOf('[');
  const closeBracket = before.lastIndexOf(']');
  const openParen = before.lastIndexOf('(');
  const closeParen = before.lastIndexOf(')');
  return openBracket > closeBracket || openParen > closeParen;
}

export function sanitizeLinkTitle(title: string): string {
  return title.replace(/[\r\n]+/g, ' ').replace(/]/g, '').trim();
}

export function formatPastedUrl(
  url: string,
  format: UrlPasteFormat,
  title?: string
): string {
  const href = url.trim();
  if (format === 'plain') return href;
  if (format === 'angle') return `<${href}>`;
  const label = sanitizeLinkTitle(title ?? '') || href;
  return `[${label}](${href})`;
}

export function wrapSelectionWithUrl(selected: string, url: string): string {
  const href = url.trim();
  const label = selected.length > 0 ? selected.replace(/]/g, '') : 'link';
  return `[${label}](${href})`;
}
