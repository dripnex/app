/**
 * Plugin registry — Inkdrop-style package index.
 *
 * Public:
 *   GET  /plugins              list published packages
 *   GET  /plugins/:slug        package detail
 *   GET  /plugins/:slug/download  redirect to the current tarball
 *
 * Auth (Bearer JWT):
 *   POST /plugins              publish / update a package you own
 *
 * First-party packages (e.g. stamp) are merged in when missing from the DB
 * so Browse works before Turso is seeded. Only include a satellite that has a
 * packed GitHub Release tarball (`{id}-{version}.tar.gz`). A git tag is not
 * enough — Settings → Plugins → Browse Install would 404.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, like, and, desc, asc } from 'drizzle-orm';
import { createDb, type Env } from '../db/client.js';
import { pluginCatalog, pluginVersions } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';

const plugins = new Hono<{ Bindings: Env }>();

const SLUG_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const SEMVER_RE = /^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/;

export const FIRST_PARTY_PACKAGES = [
  {
    slug: 'stamp',
    name: 'Stamp',
    description: 'Insert the current date or timestamp at the cursor.',
    author: 'Dripnex',
    version: '0.1.0',
    category: 'editor',
    tags: ['date', 'timestamp'],
    icon: 'clock',
    downloads: 0,
    bundleUrl:
      'https://github.com/dripnex/plugin-stamp/releases/download/v0.1.0/stamp-0.1.0.tar.gz',
    repositoryUrl: 'https://github.com/dripnex/plugin-stamp',
    isBuiltIn: false,
    status: 'published',
    createdAt: '2026-08-18T00:00:00.000Z',
    updatedAt: '2026-08-18T00:00:00.000Z',
  },
  {
    // manifest.id === slug. The GitHub repo is dripnex/plugin-vim (#562).
    slug: 'dripnex-vim-mode',
    name: 'Vim Mode',
    description: 'Vim keybindings, Ex commands, relative line numbers, and clipboard yank.',
    author: 'Dripnex',
    version: '1.2.0',
    category: 'editor',
    tags: ['vim', 'keymap'],
    icon: 'terminal',
    downloads: 0,
    bundleUrl:
      'https://github.com/dripnex/plugin-vim/releases/download/v1.2.0/dripnex-vim-mode-1.2.0.tar.gz',
    repositoryUrl: 'https://github.com/dripnex/plugin-vim',
    isBuiltIn: false,
    status: 'published',
    createdAt: '2026-08-20T17:36:18.000Z',
    updatedAt: '2026-08-20T17:36:18.000Z',
  },
  {
    slug: 'mermaid',
    name: 'Mermaid',
    description: 'Insert a mermaid fence at the cursor. Preview rendering ships with Dripnex.',
    author: 'Dripnex',
    version: '0.1.0',
    category: 'editor',
    tags: ['mermaid', 'diagram'],
    icon: 'share-2',
    downloads: 0,
    bundleUrl:
      'https://github.com/dripnex/plugin-mermaid/releases/download/v0.1.0/mermaid-0.1.0.tar.gz',
    repositoryUrl: 'https://github.com/dripnex/plugin-mermaid',
    isBuiltIn: false,
    status: 'published',
    createdAt: '2026-08-18T00:00:00.000Z',
    updatedAt: '2026-08-18T00:00:00.000Z',
  },
  {
    slug: 'math',
    name: 'Math',
    description: 'Insert a LaTeX math fence at the cursor. KaTeX rendering ships with Dripnex.',
    author: 'Dripnex',
    version: '0.1.0',
    category: 'editor',
    tags: ['math', 'latex'],
    icon: 'sigma',
    downloads: 0,
    bundleUrl: 'https://github.com/dripnex/plugin-math/releases/download/v0.1.0/math-0.1.0.tar.gz',
    repositoryUrl: 'https://github.com/dripnex/plugin-math',
    isBuiltIn: false,
    status: 'published',
    createdAt: '2026-08-18T00:00:00.000Z',
    updatedAt: '2026-08-18T00:00:00.000Z',
  },
  {
    slug: 'theme-parchment',
    name: 'Parchment',
    description: 'Warm paper palette. Official Dripnex theme.',
    author: 'Dripnex',
    version: '0.1.0',
    category: 'theme',
    tags: ['theme', 'light'],
    icon: 'sun',
    downloads: 0,
    bundleUrl:
      'https://github.com/dripnex/theme-parchment/releases/download/v0.1.0/theme-parchment-0.1.0.tar.gz',
    repositoryUrl: 'https://github.com/dripnex/theme-parchment',
    isBuiltIn: false,
    status: 'published',
    createdAt: '2026-08-18T00:00:00.000Z',
    updatedAt: '2026-08-18T00:00:00.000Z',
  },
] as const;

const listQuerySchema = z.object({
  category: z.string().optional(),
  search: z.string().optional(),
  q: z.string().optional(),
  sort: z.enum(['popular', 'newest', 'name', 'recency']).optional().default('popular'),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

const publishSchema = z.object({
  slug: z.string().regex(SLUG_RE, 'slug must be kebab-case'),
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional().default(''),
  version: z.string().regex(SEMVER_RE, 'version must be semver'),
  category: z.string().max(40).optional().default('other'),
  tags: z.array(z.string().max(32)).max(16).optional().default([]),
  icon: z.string().max(40).optional().default('puzzle'),
  repositoryUrl: z
    .string()
    .url()
    .refine(u => u.startsWith('https://'), 'repositoryUrl must be https')
    .optional(),
  bundleUrl: z
    .string()
    .url()
    .refine(u => u.startsWith('https://'), 'bundleUrl must be https'),
  readme: z.string().max(80_000).optional(),
});

type ListedPlugin = {
  slug: string;
  name: string;
  description: string;
  author: string;
  version: string;
  category: string;
  tags: string[];
  icon: string;
  downloads: number;
  bundleUrl: string | null;
  repositoryUrl: string | null;
  isBuiltIn: boolean;
  createdAt: string;
  updatedAt: string;
};

function parseTags(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

function mergeFirstParty(rows: ListedPlugin[]): ListedPlugin[] {
  const have = new Set(rows.map(r => r.slug));
  const extra = FIRST_PARTY_PACKAGES.filter(p => !have.has(p.slug)).map(p => ({
    slug: p.slug,
    name: p.name,
    description: p.description,
    author: p.author,
    version: p.version,
    category: p.category,
    tags: [...p.tags],
    icon: p.icon,
    downloads: p.downloads,
    bundleUrl: p.bundleUrl,
    repositoryUrl: p.repositoryUrl,
    isBuiltIn: p.isBuiltIn,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }));
  return [...extra, ...rows];
}

function firstPartyBySlug(slug: string): ListedPlugin | null {
  const p = FIRST_PARTY_PACKAGES.find(item => item.slug === slug);
  if (!p) return null;
  return {
    slug: p.slug,
    name: p.name,
    description: p.description,
    author: p.author,
    version: p.version,
    category: p.category,
    tags: [...p.tags],
    icon: p.icon,
    downloads: p.downloads,
    bundleUrl: p.bundleUrl,
    repositoryUrl: p.repositoryUrl,
    isBuiltIn: p.isBuiltIn,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

plugins.get('/', zValidator('query', listQuerySchema), async c => {
  const { category, search, q, sort, limit, offset } = c.req.valid('query');
  const query = (search ?? q ?? '').trim();

  let rows: ListedPlugin[];
  try {
    const db = createDb(c.env);
    const conditions = [eq(pluginCatalog.status, 'published')];
    if (category && category !== 'all') {
      conditions.push(eq(pluginCatalog.category, category));
    }
    if (query) {
      conditions.push(like(pluginCatalog.name, `%${query}%`));
    }

    const orderBy =
      sort === 'newest' || sort === 'recency'
        ? desc(pluginCatalog.createdAt)
        : sort === 'name'
          ? asc(pluginCatalog.name)
          : desc(pluginCatalog.downloads);

    const results = await db
      .select({
        slug: pluginCatalog.slug,
        name: pluginCatalog.name,
        description: pluginCatalog.description,
        author: pluginCatalog.author,
        version: pluginCatalog.version,
        category: pluginCatalog.category,
        tags: pluginCatalog.tags,
        icon: pluginCatalog.icon,
        downloads: pluginCatalog.downloads,
        bundleUrl: pluginCatalog.bundleUrl,
        repositoryUrl: pluginCatalog.repositoryUrl,
        isBuiltIn: pluginCatalog.isBuiltIn,
        createdAt: pluginCatalog.createdAt,
        updatedAt: pluginCatalog.updatedAt,
      })
      .from(pluginCatalog)
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    rows = results.map(r => ({
      ...r,
      tags: parseTags(r.tags),
      bundleUrl: r.bundleUrl,
      repositoryUrl: r.repositoryUrl,
    }));
  } catch {
    rows = [];
  }

  let pluginsOut = mergeFirstParty(rows);
  if (query) {
    const qLower = query.toLowerCase();
    pluginsOut = pluginsOut.filter(
      p =>
        p.name.toLowerCase().includes(qLower) ||
        p.slug.toLowerCase().includes(qLower) ||
        p.description.toLowerCase().includes(qLower)
    );
  }
  if (category && category !== 'all') {
    pluginsOut = pluginsOut.filter(p => p.category === category);
  }

  return c.json({ plugins: pluginsOut, total: pluginsOut.length });
});

plugins.get('/:slug/download', async c => {
  const slug = c.req.param('slug');
  const listed = await resolveSlug(c.env, slug);
  if (!listed?.bundleUrl) {
    return c.json({ error: 'Plugin not found' }, 404);
  }
  try {
    const db = createDb(c.env);
    const [row] = await db
      .select({ id: pluginCatalog.id, downloads: pluginCatalog.downloads })
      .from(pluginCatalog)
      .where(eq(pluginCatalog.slug, slug))
      .limit(1);
    if (row) {
      await db
        .update(pluginCatalog)
        .set({ downloads: row.downloads + 1 })
        .where(eq(pluginCatalog.id, row.id));
    }
  } catch {
    // first-party fallback has no row
  }
  return c.redirect(listed.bundleUrl, 302);
});

plugins.get('/:slug', async c => {
  const slug = c.req.param('slug');
  const listed = await resolveSlug(c.env, slug);
  if (!listed) {
    return c.json({ error: 'Plugin not found' }, 404);
  }
  return c.json(listed);
});

plugins.post('/', authMiddleware, zValidator('json', publishSchema), async c => {
  const body = c.req.valid('json');
  const user = c.get('user');
  const db = createDb(c.env);
  const now = new Date().toISOString();

  const [existing] = await db
    .select()
    .from(pluginCatalog)
    .where(eq(pluginCatalog.slug, body.slug))
    .limit(1);

  if (existing) {
    if (existing.ownerUserId && existing.ownerUserId !== user.userId) {
      return c.json({ error: 'That package name is already claimed.' }, 403);
    }
    await db
      .update(pluginCatalog)
      .set({
        name: body.name,
        description: body.description,
        version: body.version,
        category: body.category,
        tags: JSON.stringify(body.tags),
        icon: body.icon,
        repositoryUrl: body.repositoryUrl ?? existing.repositoryUrl,
        bundleUrl: body.bundleUrl,
        readme: body.readme ?? existing.readme,
        ownerUserId: existing.ownerUserId ?? user.userId,
        author: existing.author || user.email,
        status: 'published',
        updatedAt: now,
      })
      .where(eq(pluginCatalog.id, existing.id));

    try {
      await db.insert(pluginVersions).values({
        pluginId: existing.id,
        version: body.version,
        bundleUrl: body.bundleUrl,
        publishedBy: user.userId,
        createdAt: now,
      });
    } catch {
      // same version republished — catalog row already updated
    }

    return c.json({ slug: body.slug, version: body.version, updated: true });
  }

  const id = crypto.randomUUID();
  await db.insert(pluginCatalog).values({
    id,
    slug: body.slug,
    name: body.name,
    description: body.description,
    version: body.version,
    category: body.category,
    tags: JSON.stringify(body.tags),
    icon: body.icon,
    repositoryUrl: body.repositoryUrl,
    bundleUrl: body.bundleUrl,
    readme: body.readme,
    author: user.email,
    ownerUserId: user.userId,
    isBuiltIn: false,
    status: 'published',
    downloads: 0,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(pluginVersions).values({
    pluginId: id,
    version: body.version,
    bundleUrl: body.bundleUrl,
    publishedBy: user.userId,
    createdAt: now,
  });

  return c.json({ slug: body.slug, version: body.version, created: true }, 201);
});

async function resolveSlug(env: Env, slug: string): Promise<ListedPlugin | null> {
  try {
    const db = createDb(env);
    const [plugin] = await db
      .select()
      .from(pluginCatalog)
      .where(and(eq(pluginCatalog.slug, slug), eq(pluginCatalog.status, 'published')))
      .limit(1);
    if (plugin) {
      return {
        slug: plugin.slug,
        name: plugin.name,
        description: plugin.description,
        author: plugin.author,
        version: plugin.version,
        category: plugin.category,
        tags: parseTags(plugin.tags),
        icon: plugin.icon,
        downloads: plugin.downloads,
        bundleUrl: plugin.bundleUrl,
        repositoryUrl: plugin.repositoryUrl,
        isBuiltIn: plugin.isBuiltIn,
        createdAt: plugin.createdAt,
        updatedAt: plugin.updatedAt,
      };
    }
  } catch {
    // table missing — fall through
  }
  return firstPartyBySlug(slug);
}

export { plugins };
