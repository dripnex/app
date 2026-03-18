/**
 * Share Routes
 *
 * Public sharing of notes via unique slugs.
 * - POST /              — Create or update a shared note (authenticated)
 * - GET /public/:userId — List public notes for a user (public, paginated)
 * - GET /:slug          — Get a shared note (public)
 * - DELETE /:slug       — Remove a shared note (authenticated, owner only)
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
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
  tags: z.array(z.string()).default([]),
  backlinks: z.array(z.object({ noteId: z.string(), title: z.string() })).default([]),
  wordCount: z.number().int().min(0).default(0),
  notebookName: z.string().default(''),
});

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// ─── POST / — Create or update shared note (upsert) ─────────────────────────

share.post('/', authMiddleware, zValidator('json', createShareSchema), async c => {
  const { userId } = c.get('user');
  const { noteId, title, content, tags, backlinks, wordCount, notebookName } = c.req.valid('json');
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
      tags: JSON.stringify(tags),
      backlinks: JSON.stringify(backlinks),
      wordCount,
      notebookName,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [sharedNotes.userId, sharedNotes.noteId],
      set: {
        title,
        content,
        tags: JSON.stringify(tags),
        backlinks: JSON.stringify(backlinks),
        wordCount,
        notebookName,
        updatedAt: now,
      },
    })
    .returning({ slug: sharedNotes.slug });

  const baseUrl = c.env.SITE_URL || 'https://readied.app';
  const url = `${baseUrl}/shared?slug=${result.slug}`;

  return c.json({ slug: result.slug, url });
});

// ─── GET /public/:userId — List public notes (no auth) ──────────────────────

share.get('/public/:userId', zValidator('query', listQuerySchema), async c => {
  const userId = c.req.param('userId');
  const { limit, offset } = c.req.valid('query');
  const db = createDb(c.env);

  const notes = await db
    .select({
      slug: sharedNotes.slug,
      title: sharedNotes.title,
      tags: sharedNotes.tags,
      wordCount: sharedNotes.wordCount,
      notebookName: sharedNotes.notebookName,
      createdAt: sharedNotes.createdAt,
      updatedAt: sharedNotes.updatedAt,
    })
    .from(sharedNotes)
    .where(and(eq(sharedNotes.userId, userId), eq(sharedNotes.isPublic, true)))
    .orderBy(desc(sharedNotes.updatedAt))
    .limit(limit)
    .offset(offset);

  const parsed = notes.map(n => ({
    ...n,
    tags: JSON.parse(n.tags ?? '[]'),
  }));

  return c.json({ notes: parsed, limit, offset });
});

// ─── GET /:slug — Get shared note (public, no auth) ─────────────────────────

share.get('/:slug', async c => {
  const slug = c.req.param('slug');
  const db = createDb(c.env);

  const [note] = await db
    .select({
      title: sharedNotes.title,
      content: sharedNotes.content,
      tags: sharedNotes.tags,
      backlinks: sharedNotes.backlinks,
      wordCount: sharedNotes.wordCount,
      notebookName: sharedNotes.notebookName,
      createdAt: sharedNotes.createdAt,
      updatedAt: sharedNotes.updatedAt,
    })
    .from(sharedNotes)
    .where(and(eq(sharedNotes.slug, slug), eq(sharedNotes.isPublic, true)))
    .limit(1);

  if (!note) {
    return c.json({ error: 'Not found' }, 404);
  }

  return c.json({
    ...note,
    tags: JSON.parse(note.tags ?? '[]'),
    backlinks: JSON.parse(note.backlinks ?? '[]'),
  });
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
