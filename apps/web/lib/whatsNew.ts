import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

export interface WhatsNewRelease {
  version: string;
  date: string;
  title: string;
  status: 'draft' | 'published';
  body: string;
}

function releasesDir(): string {
  return join(process.cwd(), 'content/releases');
}

function parseFrontmatter(raw: string): { data: Record<string, string>; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: raw.trim() };
  const data: Record<string, string> = {};
  for (const line of (match[1] ?? '').split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    data[key] = value;
  }
  return { data, body: (match[2] ?? '').trim() };
}

export function loadWhatsNew(options?: { includeDrafts?: boolean }): WhatsNewRelease[] {
  const dir = releasesDir();
  if (!existsSync(dir)) return [];

  const includeDrafts = options?.includeDrafts ?? process.env.NODE_ENV !== 'production';
  const out: WhatsNewRelease[] = [];

  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.md')) continue;
    const raw = readFileSync(join(dir, file), 'utf-8');
    const { data, body } = parseFrontmatter(raw);
    const version = data.version;
    if (!version) continue;
    const status = data.status === 'published' ? 'published' : 'draft';
    if (status === 'draft' && !includeDrafts) continue;
    out.push({
      version,
      date: data.date ?? '',
      title: data.title ?? `v${version}`,
      status,
      body,
    });
  }

  return out.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
}
