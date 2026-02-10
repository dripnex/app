/**
 * Sync Routes
 *
 * Push/pull sync operations for notes.
 * All note data is end-to-end encrypted - server only sees encrypted blobs.
 *
 * Endpoints:
 * - GET /sync - Pull changes since cursor
 * - POST /sync - Push local changes
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, gt, desc, sql } from 'drizzle-orm';
import { createDb, type Env } from '../db/client.js';
import { syncLog, syncCursors, subscriptions } from '../db/schema.js';
import { authMiddleware, type AuthUser } from '../middleware/auth.js';
import { syncRateLimit } from '../middleware/rateLimit.js';

const sync = new Hono<{
  Bindings: Env;
  Variables: { user: AuthUser };
}>();

// All sync routes require auth and rate limiting
sync.use('*', authMiddleware);
sync.use('*', syncRateLimit);

// Pull changes since cursor
const pullSchema = z.object({
  cursor: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

sync.get('/', zValidator('query', pullSchema), async c => {
  const { cursor, limit } = c.req.valid('query');
  const { userId, deviceId } = c.get('user');
  const db = createDb(c.env);

  // Check subscription status
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  const isPro = sub?.status === 'active' || sub?.status === 'trialing';

  if (!isPro) {
    return c.json({ error: 'Sync requires Pro subscription' }, 403);
  }

  // Get changes since cursor
  const changes = await db
    .select()
    .from(syncLog)
    .where(and(eq(syncLog.userId, userId), gt(syncLog.version, cursor)))
    .orderBy(syncLog.version)
    .limit(limit);

  // Get max version for cursor update
  const maxVersion = changes.length > 0 ? changes[changes.length - 1].version : cursor;

  // Update cursor for this device
  if (deviceId) {
    await db
      .insert(syncCursors)
      .values({
        userId,
        deviceId,
        lastSyncedVersion: maxVersion,
      })
      .onConflictDoUpdate({
        target: [syncCursors.userId, syncCursors.deviceId],
        set: {
          lastSyncedVersion: maxVersion,
          updatedAt: new Date().toISOString(),
        },
      });
  }

  return c.json({
    changes: changes.map(entry => ({
      id: entry.id,
      noteId: entry.noteId,
      version: entry.version,
      operation: entry.operation,
      encryptedData: entry.encryptedData,
      deviceId: entry.deviceId,
      createdAt: entry.createdAt,
    })),
    cursor: maxVersion,
    hasMore: changes.length === limit,
  });
});

// Push local changes
const changeSchema = z.object({
  noteId: z.string(),
  operation: z.enum(['create', 'update', 'delete']),
  encryptedData: z.string().nullable().optional(),
  localVersion: z.number().int().optional(),
});

const pushSchema = z.object({
  changes: z.array(changeSchema).min(1).max(100),
  deviceId: z.string().uuid(),
});

sync.post('/', zValidator('json', pushSchema), async c => {
  const { changes, deviceId } = c.req.valid('json');
  const { userId } = c.get('user');
  const db = createDb(c.env);

  // Check subscription status
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  const isPro = sub?.status === 'active' || sub?.status === 'trialing';

  if (!isPro) {
    return c.json({ error: 'Sync requires Pro subscription' }, 403);
  }

  // Get current max version for this user
  const [maxVersionResult] = await db
    .select({ maxVersion: sql<number>`COALESCE(MAX(${syncLog.version}), 0)` })
    .from(syncLog)
    .where(eq(syncLog.userId, userId));

  let nextVersion = (maxVersionResult?.maxVersion ?? 0) + 1;

  // Process changes in order
  const results: Array<{
    noteId: string;
    version: number;
    status: 'applied' | 'conflict';
    serverVersion?: number;
  }> = [];

  for (const change of changes) {
    // Check for conflicts (another device updated this note)
    const [latestEntry] = await db
      .select()
      .from(syncLog)
      .where(and(eq(syncLog.userId, userId), eq(syncLog.noteId, change.noteId)))
      .orderBy(desc(syncLog.version))
      .limit(1);

    // If there's a newer version from a different device, flag as conflict
    if (
      latestEntry &&
      latestEntry.deviceId !== deviceId &&
      change.localVersion !== undefined &&
      latestEntry.version > change.localVersion
    ) {
      results.push({
        noteId: change.noteId,
        version: latestEntry.version,
        status: 'conflict',
        serverVersion: latestEntry.version,
      });
      continue;
    }

    // Insert change
    await db.insert(syncLog).values({
      userId,
      noteId: change.noteId,
      version: nextVersion,
      operation: change.operation,
      encryptedData: change.encryptedData ?? null,
      deviceId,
    });

    results.push({
      noteId: change.noteId,
      version: nextVersion,
      status: 'applied',
    });

    nextVersion++;
  }

  return c.json({
    results,
    cursor: nextVersion - 1,
  });
});

// Get sync status
sync.get('/status', async c => {
  const { userId, deviceId } = c.get('user');
  const db = createDb(c.env);

  // Get subscription
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  // Get cursor for this device
  let cursor = 0;
  if (deviceId) {
    const [cursorEntry] = await db
      .select()
      .from(syncCursors)
      .where(and(eq(syncCursors.userId, userId), eq(syncCursors.deviceId, deviceId)))
      .limit(1);
    cursor = cursorEntry?.lastSyncedVersion ?? 0;
  }

  // Get total changes count
  const [countResult] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(syncLog)
    .where(eq(syncLog.userId, userId));

  return c.json({
    enabled: sub?.status === 'active' || sub?.status === 'trialing',
    plan: sub?.plan ?? 'free',
    cursor,
    totalChanges: countResult?.count ?? 0,
  });
});

export { sync };
