/**
 * Share Routes
 *
 * Public sharing of notes via unique slugs.
 * - POST /       — Create or update a shared note (authenticated)
 * - GET /:slug   — Get a shared note (public)
 * - DELETE /:slug — Remove a shared note (authenticated, owner only)
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { createDb, type Env } from '../db/client.js';
import { sharedNotes } from '../db/schema.js';
import { authMiddleware, type AuthUser } from '../middleware/auth.js';

const share = new Hono<{
  Bindings: Env;
  Variables: { user: AuthUser };
}>();

// ─── Schemas ─────────────────────────────────────────────────────────────────

const createShareSchema = z.object({
  noteId: z.string().min(1),
  title: z.string().default(''),
  content: z.string().default(''),
});

// ─── POST / — Create or update shared note (upsert) ─────────────────────────

share.post('/', authMiddleware, zValidator('json', createShareSchema), async c => {
  const { userId } = c.get('user');
  const { noteId, title, content } = c.req.valid('json');
  const db = createDb(c.env);

  // Generate slug: first 8 hex chars of a UUID
  const slug = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  const now = new Date().toISOString();

  // Upsert: insert or update on (userId, noteId) conflict
  const [result] = await db
    .insert(sharedNotes)
    .values({
      userId,
      noteId,
      slug,
      title,
      content,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [sharedNotes.userId, sharedNotes.noteId],
      set: {
        title,
        content,
        updatedAt: now,
      },
    })
    .returning({ slug: sharedNotes.slug });

  const baseUrl = c.env.SITE_URL || 'https://readied.app';
  const url = `${baseUrl}/shared?slug=${result.slug}`;

  return c.json({ slug: result.slug, url });
});

// ─── GET /:slug — Get shared note (public, no auth) ─────────────────────────

share.get('/:slug', async c => {
  const slug = c.req.param('slug');
  const db = createDb(c.env);

  const [note] = await db
    .select({
      title: sharedNotes.title,
      content: sharedNotes.content,
      createdAt: sharedNotes.createdAt,
      updatedAt: sharedNotes.updatedAt,
    })
    .from(sharedNotes)
    .where(and(eq(sharedNotes.slug, slug), eq(sharedNotes.isPublic, true)))
    .limit(1);

  if (!note) {
    return c.json({ error: 'Not found' }, 404);
  }

  return c.json(note);
});

// ─── DELETE /:slug — Remove shared note (owner only) ─────────────────────────

share.delete('/:slug', authMiddleware, async c => {
  const { userId } = c.get('user');
  const slug = c.req.param('slug');
  const db = createDb(c.env);

  const deleted = await db
    .delete(sharedNotes)
    .where(and(eq(sharedNotes.slug, slug), eq(sharedNotes.userId, userId)))
    .returning({ id: sharedNotes.id });

  if (deleted.length === 0) {
    return c.json({ error: 'Not found' }, 404);
  }

  return c.json({ success: true });
});

export { share };
