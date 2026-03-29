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
import {
  syncLog,
  syncCursors,
  subscriptions,
  tagSyncLog,
  notebookSyncLog,
  userKeys,
} from '../db/schema.js';
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

  // Process all changes inside a transaction to serialize version assignment
  // and prevent concurrent requests from generating duplicate versions
  const { results, finalCursor } = await db.transaction(async tx => {
    // Get current max version inside the transaction
    const [maxVersionResult] = await tx
      .select({ maxVersion: sql<number>`COALESCE(MAX(${syncLog.version}), 0)` })
      .from(syncLog)
      .where(eq(syncLog.userId, userId));

    let nextVersion = (maxVersionResult?.maxVersion ?? 0) + 1;

    const txResults: Array<{
      noteId: string;
      version: number;
      status: 'applied' | 'conflict';
      serverVersion?: number;
    }> = [];

    for (const change of changes) {
      // Check for conflicts (another device updated this note)
      const [latestEntry] = await tx
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
        txResults.push({
          noteId: change.noteId,
          version: latestEntry.version,
          status: 'conflict',
          serverVersion: latestEntry.version,
        });
        continue;
      }

      // Insert change
      await tx.insert(syncLog).values({
        userId,
        noteId: change.noteId,
        version: nextVersion,
        operation: change.operation,
        encryptedData: change.encryptedData ?? null,
        deviceId,
      });

      txResults.push({
        noteId: change.noteId,
        version: nextVersion,
        status: 'applied',
      });

      nextVersion++;
    }

    return { results: txResults, finalCursor: nextVersion - 1 };
  });

  return c.json({
    results,
    cursor: finalCursor,
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

// ============================================================================
// Notebook Sync
// ============================================================================

const notebookChangeSchema = z.object({
  notebookId: z.string(),
  operation: z.enum(['create', 'update', 'delete']),
  data: z.string().nullable().optional(),
  localVersion: z.number().int().optional(),
});

const notebookPushSchema = z.object({
  changes: z.array(notebookChangeSchema).min(1).max(100),
  deviceId: z.string().uuid(),
});

/**
 * Validate notebook tree integrity before accepting push.
 * Checks: depth <= 2, parentId exists, no circular references.
 */
function validateNotebookTree(
  changes: Array<{ notebookId: string; operation: string; data?: string | null }>,
  existingNotebooks: Map<string, { parentId: string | null; depth: number }>
): { valid: true } | { valid: false; error: string; notebookId: string } {
  const tree = new Map(existingNotebooks);

  for (const change of changes) {
    if (change.operation === 'delete') {
      tree.delete(change.notebookId);
      continue;
    }
    if (!change.data) continue;
    const parsed = JSON.parse(change.data) as {
      name: string;
      parentId: string | null;
      depth: number;
      order: number;
    };

    if (parsed.depth > 2) {
      return {
        valid: false,
        error: `depth exceeds max (2), got ${parsed.depth}`,
        notebookId: change.notebookId,
      };
    }
    if (parsed.parentId && !tree.has(parsed.parentId)) {
      return {
        valid: false,
        error: `parentId '${parsed.parentId}' not found`,
        notebookId: change.notebookId,
      };
    }
    if (parsed.parentId) {
      const visited = new Set<string>([change.notebookId]);
      let current: string | null = parsed.parentId;
      while (current) {
        if (visited.has(current)) {
          return {
            valid: false,
            error: 'circular reference detected',
            notebookId: change.notebookId,
          };
        }
        visited.add(current);
        current = tree.get(current)?.parentId ?? null;
      }
    }
    tree.set(change.notebookId, { parentId: parsed.parentId, depth: parsed.depth });
  }
  return { valid: true };
}

// Pull notebook changes
sync.get('/notebooks', zValidator('query', pullSchema), async c => {
  const { cursor, limit } = c.req.valid('query');
  const { userId } = c.get('user');
  const db = createDb(c.env);

  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  if (!(sub?.status === 'active' || sub?.status === 'trialing')) {
    return c.json({ error: 'Sync requires Pro subscription' }, 403);
  }

  const changes = await db
    .select()
    .from(notebookSyncLog)
    .where(and(eq(notebookSyncLog.userId, userId), gt(notebookSyncLog.version, cursor)))
    .orderBy(notebookSyncLog.version)
    .limit(limit);

  const maxVersion = changes.length > 0 ? changes[changes.length - 1].version : cursor;

  return c.json({
    changes: changes.map(entry => ({
      id: entry.id,
      notebookId: entry.notebookId,
      version: entry.version,
      operation: entry.operation,
      data: entry.data,
      deviceId: entry.deviceId,
      createdAt: entry.createdAt,
    })),
    cursor: maxVersion,
    hasMore: changes.length === limit,
  });
});

// Push notebook changes (with tree validation)
sync.post('/notebooks', zValidator('json', notebookPushSchema), async c => {
  const { changes, deviceId } = c.req.valid('json');
  const { userId } = c.get('user');
  const db = createDb(c.env);

  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  if (!(sub?.status === 'active' || sub?.status === 'trialing')) {
    return c.json({ error: 'Sync requires Pro subscription' }, 403);
  }

  // Load existing notebooks for tree validation
  const existingEntries = await db
    .select()
    .from(notebookSyncLog)
    .where(eq(notebookSyncLog.userId, userId))
    .orderBy(desc(notebookSyncLog.version));

  const latestByNotebook = new Map<string, { parentId: string | null; depth: number }>();
  const processedIds = new Set<string>();
  for (const entry of existingEntries) {
    if (processedIds.has(entry.notebookId)) continue;
    processedIds.add(entry.notebookId);
    // Skip deleted notebooks — they shouldn't appear in the validation tree
    if (entry.operation === 'delete' || !entry.data) continue;
    const parsed = JSON.parse(entry.data);
    latestByNotebook.set(entry.notebookId, { parentId: parsed.parentId, depth: parsed.depth });
  }

  // Validate tree integrity
  const validation = validateNotebookTree(changes, latestByNotebook);
  if (!validation.valid) {
    console.warn(
      `[notebook-sync] Tree validation failed for user ${userId}: ${validation.error} (notebook: ${validation.notebookId})`
    );
    return c.json(
      {
        error: 'Tree validation failed',
        detail: validation.error,
        notebookId: validation.notebookId,
      },
      422
    );
  }

  // Process changes in transaction
  const { results: notebookResults, finalCursor: notebookFinalCursor } = await db.transaction(
    async tx => {
      const [maxVersionResult] = await tx
        .select({ maxVersion: sql<number>`COALESCE(MAX(${notebookSyncLog.version}), 0)` })
        .from(notebookSyncLog)
        .where(eq(notebookSyncLog.userId, userId));

      let nextVersion = (maxVersionResult?.maxVersion ?? 0) + 1;

      const txResults: Array<{
        notebookId: string;
        version: number;
        status: 'applied' | 'conflict';
        serverVersion?: number;
      }> = [];

      for (const change of changes) {
        const [latestEntry] = await tx
          .select()
          .from(notebookSyncLog)
          .where(
            and(
              eq(notebookSyncLog.userId, userId),
              eq(notebookSyncLog.notebookId, change.notebookId)
            )
          )
          .orderBy(desc(notebookSyncLog.version))
          .limit(1);

        if (
          latestEntry &&
          latestEntry.deviceId !== deviceId &&
          change.localVersion !== undefined &&
          latestEntry.version > change.localVersion
        ) {
          txResults.push({
            notebookId: change.notebookId,
            version: latestEntry.version,
            status: 'conflict',
            serverVersion: latestEntry.version,
          });
          continue;
        }

        await tx.insert(notebookSyncLog).values({
          userId,
          notebookId: change.notebookId,
          version: nextVersion,
          operation: change.operation,
          data: change.data ?? null,
          deviceId,
        });

        txResults.push({
          notebookId: change.notebookId,
          version: nextVersion,
          status: 'applied',
        });

        nextVersion++;
      }

      return { results: txResults, finalCursor: nextVersion - 1 };
    }
  );

  return c.json({ results: notebookResults, cursor: notebookFinalCursor });
});

// ============================================================================
// Tag Sync Endpoints
// ============================================================================

const tagPullSchema = z.object({
  cursor: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

sync.get('/tags', zValidator('query', tagPullSchema), async c => {
  const { cursor, limit } = c.req.valid('query');
  const { userId } = c.get('user');
  const db = createDb(c.env);

  // Check subscription
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  if (sub?.status !== 'active' && sub?.status !== 'trialing') {
    return c.json({ error: 'Sync requires Pro subscription' }, 403);
  }

  const changes = await db
    .select()
    .from(tagSyncLog)
    .where(and(eq(tagSyncLog.userId, userId), gt(tagSyncLog.version, cursor)))
    .orderBy(tagSyncLog.version)
    .limit(limit);

  const maxVersion = changes.length > 0 ? changes[changes.length - 1].version : cursor;

  return c.json({
    changes: changes.map(entry => ({
      id: entry.id,
      tagId: entry.tagId,
      version: entry.version,
      operation: entry.operation,
      data: entry.data,
      deviceId: entry.deviceId,
      createdAt: entry.createdAt,
    })),
    cursor: maxVersion,
    hasMore: changes.length === limit,
  });
});

const tagChangeSchema = z.object({
  tagId: z.string().uuid(),
  operation: z.enum(['create', 'update', 'delete']),
  data: z.string().nullable().optional(), // JSON: { name, color }
  localVersion: z.number().int().optional(),
});

const tagPushSchema = z.object({
  changes: z.array(tagChangeSchema).min(1).max(100),
  deviceId: z.string().uuid(),
});

sync.post('/tags', zValidator('json', tagPushSchema), async c => {
  const { changes, deviceId } = c.req.valid('json');
  const { userId } = c.get('user');
  const db = createDb(c.env);

  // Check subscription
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  if (sub?.status !== 'active' && sub?.status !== 'trialing') {
    return c.json({ error: 'Sync requires Pro subscription' }, 403);
  }

  // Validate tag data
  for (const change of changes) {
    if (change.operation !== 'delete' && change.data) {
      const parsed = JSON.parse(change.data);
      if (!parsed.name || typeof parsed.name !== 'string') {
        return c.json({ error: 'Tag data must include name' }, 422);
      }
    }
  }

  const { results, finalCursor } = await db.transaction(async tx => {
    const [maxVersionResult] = await tx
      .select({ maxVersion: sql<number>`COALESCE(MAX(${tagSyncLog.version}), 0)` })
      .from(tagSyncLog)
      .where(eq(tagSyncLog.userId, userId));

    let nextVersion = (maxVersionResult?.maxVersion ?? 0) + 1;

    const txResults: Array<{
      tagId: string;
      version: number;
      status: 'applied' | 'conflict';
      serverVersion?: number;
    }> = [];

    for (const change of changes) {
      const [latestEntry] = await tx
        .select()
        .from(tagSyncLog)
        .where(and(eq(tagSyncLog.userId, userId), eq(tagSyncLog.tagId, change.tagId)))
        .orderBy(desc(tagSyncLog.version))
        .limit(1);

      if (
        latestEntry &&
        latestEntry.deviceId !== deviceId &&
        change.localVersion !== undefined &&
        latestEntry.version > change.localVersion
      ) {
        txResults.push({
          tagId: change.tagId,
          version: latestEntry.version,
          status: 'conflict',
          serverVersion: latestEntry.version,
        });
        continue;
      }

      await tx.insert(tagSyncLog).values({
        userId,
        tagId: change.tagId,
        version: nextVersion,
        operation: change.operation,
        data: change.data ?? null,
        deviceId,
      });

      txResults.push({
        tagId: change.tagId,
        version: nextVersion,
        status: 'applied',
      });

      nextVersion++;
    }

    return { results: txResults, finalCursor: nextVersion - 1 };
  });

  return c.json({ results, cursor: finalCursor });
});

// ============================================================================
// E2EE Key Management
// ============================================================================

const postKeysSchema = z.object({
  salt: z.string().min(1), // Base64-encoded salt
  wrappedCek: z.string().min(1), // Base64-encoded wrapped CEK
  wrappedCekRecovery: z.string().nullable().optional(), // Base64-encoded wrapped CEK (recovery)
  kdfParams: z.object({
    algorithm: z.string(),
    iterations: z.number().int().min(1),
    hash: z.string(),
  }),
});

// Get encryption keys for the current user
sync.get('/keys', async c => {
  const { userId } = c.get('user');
  const db = createDb(c.env);

  const [keys] = await db.select().from(userKeys).where(eq(userKeys.userId, userId)).limit(1);

  if (!keys) {
    return c.json({ exists: false }, 200);
  }

  return c.json({
    exists: true,
    salt: keys.salt,
    wrappedCek: keys.wrappedCek,
    wrappedCekRecovery: keys.wrappedCekRecovery,
    kdfParams: JSON.parse(keys.kdfParams),
  });
});

// Store encryption keys (first device setup or passphrase change)
sync.post('/keys', zValidator('json', postKeysSchema), async c => {
  const { salt, wrappedCek, wrappedCekRecovery, kdfParams } = c.req.valid('json');
  const { userId } = c.get('user');
  const db = createDb(c.env);

  await db
    .insert(userKeys)
    .values({
      userId,
      salt,
      wrappedCek,
      wrappedCekRecovery: wrappedCekRecovery ?? null,
      kdfParams: JSON.stringify(kdfParams),
    })
    .onConflictDoUpdate({
      target: [userKeys.userId],
      set: {
        salt,
        wrappedCek,
        // Only overwrite recovery key if explicitly provided — passphrase changes
        // omit this field and must not erase the existing recovery-wrapped CEK
        ...(wrappedCekRecovery !== undefined ? { wrappedCekRecovery } : {}),
        kdfParams: JSON.stringify(kdfParams),
        updatedAt: new Date().toISOString(),
      },
    });

  return c.json({ success: true });
});

export { sync };
