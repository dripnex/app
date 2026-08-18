import type {
  HeadingLevel,
  MarkdownEmbed,
  MarkdownHeading,
  MarkdownScan,
  MarkdownWikilink,
} from './types.js';

const FENCE = /^(\s{0,3})(`{3,}|~{3,})/;
const ATX = /^(#{1,6})[ \t]+(.+?)(?:[ \t]+#+[ \t]*)?$/;
const TASK = /^[ \t]*[-*]\s+\[(.)\]/;
const EMBED = /!\[\[([^[\]|]{1,200})(?:\|([^\]]{1,200}))?\]\]/g;
const WIKI = /\[\[([^[\]|#]{1,200})(?:#([^[\]|]{1,200}))?(?:\|([^\]]{1,200}))?\]\]/g;
const TAG = /(?:^|\s)#([a-zA-Z][a-zA-Z0-9_-]*)/g;

export function headingToSlug(heading: string): string {
  return heading
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function stripInlineCode(line: string): string {
  return line.replace(/`[^`\n]+`/g, ' ');
}

/**
 * One fence-aware walk: headings, embeds, wikilinks, and GFM tasks.
 * Markdown stays the source of truth; this AST is ephemeral.
 */
export function scanMarkdown(content: string): MarkdownScan {
  const headings: MarkdownHeading[] = [];
  const embeds: MarkdownEmbed[] = [];
  const wikilinks: MarkdownWikilink[] = [];
  const wikiSeen = new Set<string>();
  const embedSeen = new Set<string>();
  const embedTargets: string[] = [];
  const tags: string[] = [];
  const tagSeen = new Set<string>();
  let tasksTotal = 0;
  let tasksDone = 0;

  const lines = content.split(/\r?\n/);
  let fence: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const fenceMatch = line.match(FENCE);
    if (fenceMatch) {
      const marker = fenceMatch[2] ?? '';
      if (!fence) {
        fence = marker;
        continue;
      }
      if (marker[0] === fence[0] && marker.length >= fence.length) {
        fence = null;
      }
      continue;
    }
    if (fence) continue;

    const atx = line.match(ATX);
    if (atx) {
      const text = (atx[2] ?? '').trim();
      if (text) {
        const level = (atx[1] ?? '#').length as HeadingLevel;
        headings.push({ level, text, line: i + 1, slug: headingToSlug(text) });
      }
    }

    const task = line.match(TASK);
    if (task) {
      tasksTotal += 1;
      if (task[1] === 'x' || task[1] === 'X') tasksDone += 1;
    }

    const searchable = stripInlineCode(line);
    EMBED.lastIndex = 0;
    let embedMatch: RegExpExecArray | null;
    while ((embedMatch = EMBED.exec(searchable)) !== null) {
      const target = embedMatch[1]?.trim();
      if (!target) continue;
      const display = embedMatch[2]?.trim();
      embeds.push(display ? { target, display } : { target });
      const lower = target.toLowerCase();
      if (!embedSeen.has(lower)) {
        embedSeen.add(lower);
        embedTargets.push(target);
      }
    }

    WIKI.lastIndex = 0;
    let wikiMatch: RegExpExecArray | null;
    while ((wikiMatch = WIKI.exec(searchable)) !== null) {
      const index = wikiMatch.index ?? 0;
      if (index > 0 && searchable[index - 1] === '!') continue;
      const target = wikiMatch[1]?.trim();
      if (!target) continue;
      const anchor = wikiMatch[2]?.trim();
      const display = wikiMatch[3]?.trim();
      const key = `${target.toLowerCase()}#${anchor?.toLowerCase() ?? ''}`;
      if (wikiSeen.has(key)) continue;
      wikiSeen.add(key);
      const link: MarkdownWikilink = { target };
      if (anchor) link.anchor = anchor;
      if (display) link.display = display;
      wikilinks.push(link);
    }

    TAG.lastIndex = 0;
    let tagMatch: RegExpExecArray | null;
    while ((tagMatch = TAG.exec(searchable)) !== null) {
      const name = tagMatch[1]?.toLowerCase();
      if (!name || tagSeen.has(name)) continue;
      tagSeen.add(name);
      tags.push(name);
    }
  }

  return {
    headings,
    embeds,
    embedTargets,
    wikilinks,
    tasks: { total: tasksTotal, completed: tasksDone },
    tags,
  };
}
