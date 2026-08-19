/** `[[Title]]`, `[[Title#Heading]]`, or `[[#Heading]]`. */
export function formatWikilink(title: string, heading?: string | null): string {
  const target = title.trim();
  const anchor = heading?.trim();
  if (anchor && target) return `[[${target}#${anchor}]]`;
  if (anchor) return `[[#${anchor}]]`;
  return `[[${target}]]`;
}
