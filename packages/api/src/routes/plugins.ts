/**
 * Plugin Catalog Routes
 *
 * Public marketplace API for browsing and discovering plugins.
 * - GET /          — List plugins (filterable, sortable, searchable)
 * - GET /:slug     — Get single plugin detail
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, like, and, desc, asc } from 'drizzle-orm';
import { createDb, type Env } from '../db/client.js';
import { pluginCatalog } from '../db/schema.js';

const plugins = new Hono<{ Bindings: Env }>();

// ─── Schemas ─────────────────────────────────────────────────────────────────

const listQuerySchema = z.object({
  category: z.string().optional(),
  search: z.string().optional(),
  sort: z.enum(['popular', 'newest', 'name']).optional().default('popular'),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

// ─── GET / — List plugins ────────────────────────────────────────────────────

plugins.get('/', zValidator('query', listQuerySchema), async c => {
  const { category, search, sort, limit, offset } = c.req.valid('query');
  const db = createDb(c.env);

  // Build conditions
  const conditions = [eq(pluginCatalog.status, 'published')];

  if (category && category !== 'all') {
    conditions.push(eq(pluginCatalog.category, category));
  }

  if (search) {
    conditions.push(like(pluginCatalog.name, `%${search}%`));
  }

  // Sort
  const orderBy =
    sort === 'newest'
      ? desc(pluginCatalog.createdAt)
      : sort === 'name'
        ? asc(pluginCatalog.name)
        : desc(pluginCatalog.downloads); // 'popular' default

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
      isBuiltIn: pluginCatalog.isBuiltIn,
      createdAt: pluginCatalog.createdAt,
      updatedAt: pluginCatalog.updatedAt,
    })
    .from(pluginCatalog)
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  // Parse tags from JSON string
  const parsed = results.map(r => ({
    ...r,
    tags: JSON.parse(r.tags) as string[],
  }));

  return c.json({ plugins: parsed, total: parsed.length });
});

// ─── GET /:slug — Get plugin detail ─────────────────────────────────────────

plugins.get('/:slug', async c => {
  const slug = c.req.param('slug');
  const db = createDb(c.env);

  const [plugin] = await db
    .select()
    .from(pluginCatalog)
    .where(and(eq(pluginCatalog.slug, slug), eq(pluginCatalog.status, 'published')))
    .limit(1);

  if (!plugin) {
    return c.json({ error: 'Plugin not found' }, 404);
  }

  return c.json({
    ...plugin,
    tags: JSON.parse(plugin.tags) as string[],
  });
});

export { plugins };
