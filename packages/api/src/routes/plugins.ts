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
 * First-party packs: GitHub org `dripnex` repos named `theme-*` / `plugin-*`
 * with a packed Release `.tar.gz` are the live list. FIRST_PARTY_PACKAGES is
 * the seed (GitHub down) and the slug/name/description override map — not a
 * second catalog to keep in lockstep with daily theme satellites. Only a
 * packed `{id}-{version}.tar.gz` is listed; a git tag is not enough.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, like, and, desc, asc } from 'drizzle-orm';
import { createDb, type Env } from '../db/client.js';
import { pluginCatalog, pluginVersions } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import {
  discoverDripnexPacks,
  humanizeRepoName,
  normalizeGithubRepoUrl,
  resolveDiscoveredSlug,
  type DiscoveredPack,
} from '../services/githubPacks.js';

const plugins = new Hono<{ Bindings: Env }>();

const SLUG_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const SEMVER_RE = /^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/;

/** Seed + slug/name/icon overrides. GitHub discovery is the live list. */
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
  {
    slug: 'theme-harbor-dusk',
    name: 'Harbor Dusk',
    description: 'Coastal evening palette for long writing sessions.',
    author: 'Dripnex',
    version: '0.1.0',
    category: 'theme',
    tags: ['theme', 'dark'],
    icon: 'moon',
    downloads: 0,
    bundleUrl:
      'https://github.com/dripnex/theme-harbor-dusk/releases/download/v0.1.0/theme-harbor-dusk-0.1.0.tar.gz',
    repositoryUrl: 'https://github.com/dripnex/theme-harbor-dusk',
    isBuiltIn: false,
    status: 'published',
    createdAt: '2026-08-24T18:13:05.000Z',
    updatedAt: '2026-08-24T18:13:05.000Z',
  },
  {
    slug: 'theme-wave',
    name: 'Wave',
    description: 'Ink and paper, after dark.',
    author: 'Dripnex',
    version: '0.1.0',
    category: 'theme',
    tags: ['theme', 'dark'],
    icon: 'moon',
    downloads: 0,
    bundleUrl:
      'https://github.com/dripnex/theme-wave/releases/download/v0.1.0/theme-wave-0.1.0.tar.gz',
    repositoryUrl: 'https://github.com/dripnex/theme-wave',
    isBuiltIn: false,
    status: 'published',
    createdAt: '2026-08-24T18:13:09.000Z',
    updatedAt: '2026-08-24T18:13:09.000Z',
  },
  {
    slug: 'theme-night',
    name: 'Night',
    description: 'Violet dusk. Focused writing after hours.',
    author: 'Dripnex',
    version: '0.1.0',
    category: 'theme',
    tags: ['theme', 'dark'],
    icon: 'moon',
    downloads: 0,
    bundleUrl:
      'https://github.com/dripnex/theme-night/releases/download/v0.1.0/theme-night-0.1.0.tar.gz',
    repositoryUrl: 'https://github.com/dripnex/theme-night',
    isBuiltIn: false,
    status: 'published',
    createdAt: '2026-08-24T18:13:10.000Z',
    updatedAt: '2026-08-24T18:13:10.000Z',
  },
  {
    slug: 'theme-solarized-dark',
    name: 'Solarized Dark',
    description: 'Ethan Schoonover. The Vim classic.',
    author: 'Dripnex',
    version: '0.1.0',
    category: 'theme',
    tags: ['theme', 'dark'],
    icon: 'moon',
    downloads: 0,
    bundleUrl:
      'https://github.com/dripnex/theme-solarized-dark/releases/download/v0.1.0/theme-solarized-dark-0.1.0.tar.gz',
    repositoryUrl: 'https://github.com/dripnex/theme-solarized-dark',
    isBuiltIn: false,
    status: 'published',
    createdAt: '2026-08-24T18:13:13.000Z',
    updatedAt: '2026-08-24T18:13:13.000Z',
  },
  {
    slug: 'theme-solarized-light',
    name: 'Solarized Light',
    description: 'Cream paper, cyan marks. Same palette, daylight.',
    author: 'Dripnex',
    version: '0.1.0',
    category: 'theme',
    tags: ['theme', 'light'],
    icon: 'sun',
    downloads: 0,
    bundleUrl:
      'https://github.com/dripnex/theme-solarized-light/releases/download/v0.1.0/theme-solarized-light-0.1.0.tar.gz',
    repositoryUrl: 'https://github.com/dripnex/theme-solarized-light',
    isBuiltIn: false,
    status: 'published',
    createdAt: '2026-08-24T18:13:13.000Z',
    updatedAt: '2026-08-24T18:13:13.000Z',
  },
  {
    slug: 'theme-gruvbox',
    name: 'Gruvbox',
    description: 'Retro groove. The other Vim default.',
    author: 'Dripnex',
    version: '0.1.0',
    category: 'theme',
    tags: ['theme', 'dark'],
    icon: 'moon',
    downloads: 0,
    bundleUrl:
      'https://github.com/dripnex/theme-gruvbox/releases/download/v0.1.0/theme-gruvbox-0.1.0.tar.gz',
    repositoryUrl: 'https://github.com/dripnex/theme-gruvbox',
    isBuiltIn: false,
    status: 'published',
    createdAt: '2026-08-24T18:13:17.000Z',
    updatedAt: '2026-08-24T18:13:17.000Z',
  },
  {
    slug: 'theme-glass',
    name: 'Glass',
    description: 'Ice. The desktop shows through.',
    author: 'Dripnex',
    version: '0.1.0',
    category: 'theme',
    tags: ['theme', 'dark'],
    icon: 'moon',
    downloads: 0,
    bundleUrl:
      'https://github.com/dripnex/theme-glass/releases/download/v0.1.0/theme-glass-0.1.0.tar.gz',
    repositoryUrl: 'https://github.com/dripnex/theme-glass',
    isBuiltIn: false,
    status: 'published',
    createdAt: '2026-08-24T18:13:51.000Z',
    updatedAt: '2026-08-24T18:13:51.000Z',
  },
  {
    slug: 'theme-midnight',
    name: 'Midnight',
    description: 'OLED navy, electric blue. Frosted.',
    author: 'Dripnex',
    version: '0.1.0',
    category: 'theme',
    tags: ['theme', 'dark'],
    icon: 'moon',
    downloads: 0,
    bundleUrl:
      'https://github.com/dripnex/theme-midnight/releases/download/v0.1.0/theme-midnight-0.1.0.tar.gz',
    repositoryUrl: 'https://github.com/dripnex/theme-midnight',
    isBuiltIn: false,
    status: 'published',
    createdAt: '2026-08-24T18:13:50.000Z',
    updatedAt: '2026-08-24T18:13:50.000Z',
  },
  {
    slug: 'theme-ember',
    name: 'Ember',
    description: 'Warm black, copper light. Frosted.',
    author: 'Dripnex',
    version: '0.1.0',
    category: 'theme',
    tags: ['theme', 'dark'],
    icon: 'moon',
    downloads: 0,
    bundleUrl:
      'https://github.com/dripnex/theme-ember/releases/download/v0.1.0/theme-ember-0.1.0.tar.gz',
    repositoryUrl: 'https://github.com/dripnex/theme-ember',
    isBuiltIn: false,
    status: 'published',
    createdAt: '2026-08-24T18:13:54.000Z',
    updatedAt: '2026-08-24T18:13:54.000Z',
  },
  {
    slug: 'theme-ion',
    name: 'Ion',
    description: 'Violet glass. Linear-adjacent, frosted.',
    author: 'Dripnex',
    version: '0.1.0',
    category: 'theme',
    tags: ['theme', 'dark'],
    icon: 'moon',
    downloads: 0,
    bundleUrl:
      'https://github.com/dripnex/theme-ion/releases/download/v0.1.0/theme-ion-0.1.0.tar.gz',
    repositoryUrl: 'https://github.com/dripnex/theme-ion',
    isBuiltIn: false,
    status: 'published',
    createdAt: '2026-08-24T18:13:53.000Z',
    updatedAt: '2026-08-24T18:13:53.000Z',
  },
  {
    slug: 'theme-matcha',
    name: 'Matcha',
    description: 'Green-tea paper. Calm reading.',
    author: 'Dripnex',
    version: '0.1.0',
    category: 'theme',
    tags: ['theme', 'light'],
    icon: 'sun',
    downloads: 0,
    bundleUrl:
      'https://github.com/dripnex/theme-matcha/releases/download/v0.1.0/theme-matcha-0.1.0.tar.gz',
    repositoryUrl: 'https://github.com/dripnex/theme-matcha',
    isBuiltIn: false,
    status: 'published',
    createdAt: '2026-08-24T18:13:57.000Z',
    updatedAt: '2026-08-24T18:13:57.000Z',
  },
  {
    slug: 'theme-phosphor',
    name: 'Phosphor',
    description: 'Amber CRT. Terminal glow after midnight.',
    author: 'Dripnex',
    version: '0.1.0',
    category: 'theme',
    tags: ['theme', 'dark'],
    icon: 'moon',
    downloads: 0,
    bundleUrl:
      'https://github.com/dripnex/theme-phosphor/releases/download/v0.1.0/theme-phosphor-0.1.0.tar.gz',
    repositoryUrl: 'https://github.com/dripnex/theme-phosphor',
    isBuiltIn: false,
    status: 'published',
    createdAt: '2026-08-24T18:14:03.000Z',
    updatedAt: '2026-08-24T18:14:03.000Z',
  },
  {
    slug: 'theme-fog',
    name: 'Fog',
    description: 'Coastal gray morning. Muted blue marks.',
    author: 'Dripnex',
    version: '0.1.0',
    category: 'theme',
    tags: ['theme', 'light'],
    icon: 'sun',
    downloads: 0,
    bundleUrl:
      'https://github.com/dripnex/theme-fog/releases/download/v0.1.0/theme-fog-0.1.0.tar.gz',
    repositoryUrl: 'https://github.com/dripnex/theme-fog',
    isBuiltIn: false,
    status: 'published',
    createdAt: '2026-08-24T18:14:02.000Z',
    updatedAt: '2026-08-24T18:14:02.000Z',
  },
  {
    slug: 'theme-dune',
    name: 'Dune',
    description: 'Desert afternoon. Sand paper, terracotta marks.',
    author: 'Dripnex',
    version: '0.1.0',
    category: 'theme',
    tags: ['theme', 'light'],
    icon: 'sun',
    downloads: 0,
    bundleUrl:
      'https://github.com/dripnex/theme-dune/releases/download/v0.1.0/theme-dune-0.1.0.tar.gz',
    repositoryUrl: 'https://github.com/dripnex/theme-dune',
    isBuiltIn: false,
    status: 'published',
    createdAt: '2026-08-25T00:56:46.000Z',
    updatedAt: '2026-08-25T00:58:04.000Z',
  },
  {
    slug: 'theme-noir',
    name: 'Noir',
    description: 'Cinema black. Cool silver, a single crimson mark.',
    author: 'Dripnex',
    version: '0.1.0',
    category: 'theme',
    tags: ['theme', 'dark'],
    icon: 'moon',
    downloads: 0,
    bundleUrl:
      'https://github.com/dripnex/theme-noir/releases/download/v0.1.0/theme-noir-0.1.0.tar.gz',
    repositoryUrl: 'https://github.com/dripnex/theme-noir',
    isBuiltIn: false,
    status: 'published',
    createdAt: '2026-08-25T00:56:48.000Z',
    updatedAt: '2026-08-25T00:58:43.000Z',
  },
  {
    slug: 'theme-sakura',
    name: 'Sakura',
    description: 'Cherry-blossom paper. Pale rose, quiet ink.',
    author: 'Dripnex',
    version: '0.1.0',
    category: 'theme',
    tags: ['theme', 'light'],
    icon: 'sun',
    downloads: 0,
    bundleUrl:
      'https://github.com/dripnex/theme-sakura/releases/download/v0.1.0/theme-sakura-0.1.0.tar.gz',
    repositoryUrl: 'https://github.com/dripnex/theme-sakura',
    isBuiltIn: false,
    status: 'published',
    createdAt: '2026-08-25T00:56:50.000Z',
    updatedAt: '2026-08-25T00:58:57.000Z',
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

function listedFromSeed(p: (typeof FIRST_PARTY_PACKAGES)[number]): ListedPlugin {
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

function seedByRepository(htmlUrl: string): (typeof FIRST_PARTY_PACKAGES)[number] | undefined {
  const key = normalizeGithubRepoUrl(htmlUrl);
  return FIRST_PARTY_PACKAGES.find(p => normalizeGithubRepoUrl(p.repositoryUrl) === key);
}

async function listedFromDiscovered(
  pack: DiscoveredPack,
  fetchImpl: typeof fetch
): Promise<ListedPlugin> {
  const override = seedByRepository(pack.htmlUrl);
  const slug = await resolveDiscoveredSlug(pack, override?.slug, fetchImpl);
  const isTheme = pack.kind === 'theme';
  return {
    slug,
    name: override?.name ?? humanizeRepoName(pack.repoName),
    description: override?.description ?? pack.description,
    author: override?.author ?? 'Dripnex',
    version: pack.version,
    category: override?.category ?? (isTheme ? 'theme' : 'editor'),
    tags: override ? [...override.tags] : isTheme ? ['theme'] : [],
    icon: override?.icon ?? (isTheme ? 'palette' : 'puzzle'),
    downloads: override?.downloads ?? 0,
    bundleUrl: pack.bundleUrl,
    repositoryUrl: pack.htmlUrl,
    isBuiltIn: false,
    createdAt: override?.createdAt ?? pack.createdAt,
    updatedAt: pack.updatedAt,
  };
}

function mergeBySlug(primary: ListedPlugin[], extras: ListedPlugin[]): ListedPlugin[] {
  const have = new Set(primary.map(r => r.slug));
  const extra = extras.filter(p => !have.has(p.slug));
  return [...extra, ...primary];
}

/**
 * Live first-party list: GitHub discovery with seed overrides, or the static
 * seed alone when GitHub is down / the scan was incomplete. Seed rows still
 * fill gaps (vim, parchment, dune/noir/sakura) if a matching repo was skipped.
 */
async function firstPartyCatalog(env: Env): Promise<ListedPlugin[]> {
  const seed = FIRST_PARTY_PACKAGES.map(listedFromSeed);
  const discovered = await discoverDripnexPacks({ token: env.GITHUB_TOKEN, fetchImpl: fetch });
  if (!discovered) return seed;
  const live = await Promise.all(discovered.map(pack => listedFromDiscovered(pack, fetch)));
  return mergeBySlug(live, seed);
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

  let pluginsOut = mergeBySlug(rows, await firstPartyCatalog(c.env));
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

  return c.json({ plugins: pluginsOut, total: pluginsOut.length }, 200, {
    'Cache-Control': 'private, no-store',
  });
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
  const catalog = await firstPartyCatalog(env);
  return catalog.find(p => p.slug === slug) ?? null;
}

export { plugins };
