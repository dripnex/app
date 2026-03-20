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
import { createDb, type Env } from '../db/client.js';
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

// Simple admin auth — checks ADMIN_TOKEN header
admin.use('*', async (c, next) => {
  const token = c.req.header('x-admin-token');
  const expected = c.env.ADMIN_TOKEN;

  if (!expected) {
    return c.json({ error: 'Admin access not configured' }, 503);
  }

  if (token !== expected) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  await next();
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

export { admin };
