const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
};

export function titleFromHtml(html: string): string | null {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const raw = match?.[1]?.trim();
  if (!raw) return null;
  const title = raw
    .replace(/&(amp|lt|gt|quot|#39|apos);/g, entity => ENTITIES[entity] ?? entity)
    .replace(/[\r\n]+/g, ' ')
    .trim();
  return title || null;
}
