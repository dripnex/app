/**
 * Admin Dashboard Routes
 *
 * Provides aggregated metrics for the app dashboard.
 * Protected by a simple admin token check.
 *
 * Endpoints:
 * - GET /admin/stats - Aggregated app statistics
 * - GET /admin/users - User list with subscription info
 * - GET /admin/sync - Sync activity summary
 */

import { Hono } from 'hono';
import { sql, desc, eq } from 'drizzle-orm';
import * as jose from 'jose';
import { createDb, type Env } from '../db/client.js';
import { listMigrationStatus, runMigrations } from '../db/runMigrations.js';
import {
  users,
  subscriptions,
  devices,
  syncLog,
  sharedNotes,
  newsletter,
  tagSyncLog,
  notebookSyncLog,
} from '../db/schema.js';

const admin = new Hono<{ Bindings: Env }>();

// Admin emails that can access the dashboard
const ADMIN_EMAILS = ['dripnex@gmail.com', 'tomymaritano@gmail.com'];

// Admin auth — accepts admin token OR authenticated admin user
admin.use('*', async (c, next) => {
  // Method 1: Admin token header
  const token = c.req.header('x-admin-token');
  if (token && token === c.env.ADMIN_TOKEN) {
    await next();
    return;
  }

  // Method 2: JWT auth — check if the *verified* user email is admin.
  // SECURITY: the signature MUST be verified with jwtVerify. Decoding the
  // payload with atob() and trusting the `email` claim lets anyone forge an
  // admin token. jwtVerify also enforces exp, so no manual expiry check.
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7);
      const secret = new TextEncoder().encode(c.env.JWT_SECRET);
      const { payload } = await jose.jwtVerify(token, secret, { algorithms: ['HS256'] });
      // Refresh tokens must never grant access.
      if (payload.type !== 'refresh') {
        const email = typeof payload.email === 'string' ? payload.email : undefined;
        if (email && ADMIN_EMAILS.includes(email)) {
          await next();
          return;
        }
      }
    } catch {
      // Invalid / expired / unsigned token — fall through to 401.
    }
  }

  return c.json({ error: 'Unauthorized' }, 401);
});

// ── GET /stats — Aggregated dashboard stats ─────────────────────────────────

admin.get('/stats', async c => {
  const db = createDb(c.env);

  // User counts
  const [userCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(users);

  // Subscription breakdown
  const subStats = await db
    .select({
      status: subscriptions.status,
      plan: subscriptions.plan,
      count: sql<number>`COUNT(*)`,
    })
    .from(subscriptions)
    .groupBy(subscriptions.status, subscriptions.plan);

  // Device count
  const [deviceCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(devices);

  // Sync activity (last 24h)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [syncCount24h] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(syncLog)
    .where(sql`${syncLog.createdAt} > ${oneDayAgo}`);

  // Total sync entries
  const [syncTotal] = await db.select({ count: sql<number>`COUNT(*)` }).from(syncLog);

  // Shared notes
  const [sharedCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(sharedNotes);

  // Newsletter subscribers
  const [newsletterCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(newsletter);

  // Users created in last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [newUsersWeek] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(users)
    .where(sql`${users.createdAt} > ${sevenDaysAgo}`);

  return c.json({
    users: {
      total: userCount?.count ?? 0,
      newLast7Days: newUsersWeek?.count ?? 0,
    },
    subscriptions: subStats.map(s => ({
      status: s.status,
      plan: s.plan,
      count: s.count,
    })),
    devices: {
      total: deviceCount?.count ?? 0,
    },
    sync: {
      totalEntries: syncTotal?.count ?? 0,
      last24h: syncCount24h?.count ?? 0,
    },
    sharedNotes: sharedCount?.count ?? 0,
    newsletter: newsletterCount?.count ?? 0,
    timestamp: new Date().toISOString(),
  });
});

// ── GET /users — User list with details ─────────────────────────────────────

admin.get('/users', async c => {
  const db = createDb(c.env);

  const allUsers = await db
    .select({
      id: users.id,
      email: users.email,
      createdAt: users.createdAt,
      subStatus: subscriptions.status,
      subPlan: subscriptions.plan,
    })
    .from(users)
    .leftJoin(subscriptions, eq(subscriptions.userId, users.id))
    .orderBy(desc(users.createdAt));

  // Get device counts per user
  const deviceCounts = await db
    .select({
      userId: devices.userId,
      count: sql<number>`COUNT(*)`,
    })
    .from(devices)
    .groupBy(devices.userId);

  const deviceMap = new Map(deviceCounts.map(d => [d.userId, d.count]));

  return c.json({
    users: allUsers.map(u => ({
      id: u.id,
      email: u.email,
      createdAt: u.createdAt,
      subscription: u.subStatus ? { status: u.subStatus, plan: u.subPlan } : null,
      deviceCount: deviceMap.get(u.id) ?? 0,
    })),
  });
});

// ── GET /sync — Sync activity ───────────────────────────────────────────────

admin.get('/sync', async c => {
  const db = createDb(c.env);

  // Recent sync activity per user
  const recentSync = await db
    .select({
      userId: syncLog.userId,
      noteId: syncLog.noteId,
      operation: syncLog.operation,
      createdAt: syncLog.createdAt,
    })
    .from(syncLog)
    .orderBy(desc(syncLog.createdAt))
    .limit(50);

  // Sync volume by day (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const dailyVolume = await db
    .select({
      day: sql<string>`date(${syncLog.createdAt})`,
      count: sql<number>`COUNT(*)`,
    })
    .from(syncLog)
    .where(sql`${syncLog.createdAt} > ${sevenDaysAgo}`)
    .groupBy(sql`date(${syncLog.createdAt})`)
    .orderBy(sql`date(${syncLog.createdAt})`);

  // Tag + notebook sync counts
  const [tagSyncCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(tagSyncLog);

  const [notebookSyncCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(notebookSyncLog);

  return c.json({
    recentActivity: recentSync,
    dailyVolume,
    tagSyncEntries: tagSyncCount?.count ?? 0,
    notebookSyncEntries: notebookSyncCount?.count ?? 0,
  });
});

admin.get('/migrations', async c => {
  const status = await listMigrationStatus(c.env);
  return c.json({ ok: true, ...status });
});

/** Apply every pending Drizzle migration. Safe to call repeatedly. */
admin.post('/migrate', async c => {
  const report = await runMigrations(c.env);
  return c.json({ ok: true, ...report });
});

export { admin };
