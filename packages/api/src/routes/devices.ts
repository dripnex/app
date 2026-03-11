/**
 * Device Routes
 *
 * Manage registered sync devices for the authenticated user.
 * - GET /              — List all devices
 * - POST /revoke-others — Revoke all devices except current
 * - DELETE /:deviceId  — Revoke (delete) a single device
 * - PATCH /:deviceId   — Rename a device
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { createDb, type Env } from '../db/client.js';
import { devices, syncCursors } from '../db/schema.js';
import { authMiddleware, type AuthUser } from '../middleware/auth.js';

const deviceRoutes = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();

// ─── Schemas ─────────────────────────────────────────────────────────────────

const renameSchema = z.object({
  name: z.string().min(1).max(100),
});

// ─── GET / — List all devices ────────────────────────────────────────────────

deviceRoutes.get('/', authMiddleware, async c => {
  const { userId, deviceId: currentDeviceId } = c.get('user');
  const db = createDb(c.env);

  const rows = await db
    .select()
    .from(devices)
    .where(eq(devices.userId, userId))
    .orderBy(desc(devices.lastSeenAt));

  return c.json({
    devices: rows.map(row => ({
      id: row.id,
      deviceId: row.deviceId,
      name: row.name,
      platform: row.platform,
      isCurrent: row.deviceId === currentDeviceId,
      lastSeenAt: row.lastSeenAt,
      createdAt: row.createdAt,
    })),
  });
});

// ─── POST /revoke-others — Revoke all devices except current ─────────────────

deviceRoutes.post('/revoke-others', authMiddleware, async c => {
  const { userId, deviceId: currentDeviceId } = c.get('user');

  if (!currentDeviceId) {
    return c.json({ error: 'Current device ID is required' }, 400);
  }

  const db = createDb(c.env);

  const allDevices = await db
    .select()
    .from(devices)
    .where(eq(devices.userId, userId));

  const others = allDevices.filter(d => d.deviceId !== currentDeviceId);

  for (const device of others) {
    await db
      .delete(syncCursors)
      .where(
        and(eq(syncCursors.userId, userId), eq(syncCursors.deviceId, device.deviceId))
      );
    await db
      .delete(devices)
      .where(and(eq(devices.userId, userId), eq(devices.deviceId, device.deviceId)));
  }

  return c.json({ success: true, revokedCount: others.length });
});

// ─── DELETE /:deviceId — Revoke (delete) a single device ─────────────────────

deviceRoutes.delete('/:deviceId', authMiddleware, async c => {
  const { userId } = c.get('user');
  const { deviceId } = c.req.param();
  const db = createDb(c.env);

  const result = await db
    .delete(devices)
    .where(and(eq(devices.userId, userId), eq(devices.deviceId, deviceId)));

  if (result.rowsAffected === 0) {
    return c.json({ error: 'Device not found' }, 404);
  }

  await db
    .delete(syncCursors)
    .where(and(eq(syncCursors.userId, userId), eq(syncCursors.deviceId, deviceId)));

  return c.json({ success: true });
});

// ─── PATCH /:deviceId — Rename a device ──────────────────────────────────────

deviceRoutes.patch(
  '/:deviceId',
  authMiddleware,
  zValidator('json', renameSchema),
  async c => {
    const { userId } = c.get('user');
    const { deviceId } = c.req.param();
    const { name } = c.req.valid('json');
    const db = createDb(c.env);

    const result = await db
      .update(devices)
      .set({ name })
      .where(and(eq(devices.userId, userId), eq(devices.deviceId, deviceId)));

    if (result.rowsAffected === 0) {
      return c.json({ error: 'Device not found' }, 404);
    }

    return c.json({ success: true });
  }
);

export { deviceRoutes };
