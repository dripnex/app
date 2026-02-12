/**
 * Auth Routes
 *
 * Magic link authentication flow:
 * 1. POST /auth/magic-link - Send magic link email
 * 2. POST /auth/verify - Verify token and get JWT
 * 3. POST /auth/refresh - Refresh access token
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, gt, isNull } from 'drizzle-orm';
import { createDb, type Env } from '../db/client.js';
import { users, magicLinks, devices } from '../db/schema.js';
import { createTokens, verifyRefreshToken, authMiddleware } from '../middleware/auth.js';
import { authRateLimit } from '../middleware/rateLimit.js';
import { createEmailService } from '../services/email.js';

const auth = new Hono<{ Bindings: Env }>();

// Apply rate limiting to all auth routes
auth.use('*', authRateLimit);

// Request magic link
const magicLinkSchema = z.object({
  email: z.string().email(),
});

auth.post('/magic-link', zValidator('json', magicLinkSchema), async c => {
  const { email } = c.req.valid('json');
  const db = createDb(c.env);

  // Find or create user
  let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (!user) {
    [user] = await db.insert(users).values({ email }).returning();
  }

  // Generate magic link token
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes

  await db.insert(magicLinks).values({
    userId: user.id,
    token,
    expiresAt,
  });

  // Send email
  const emailService = createEmailService(c.env.RESEND_API_KEY);
  const magicLinkUrl = `https://readied.app/auth/verify?token=${token}`;
  const emailSent = await emailService.sendMagicLink(email, magicLinkUrl);

  if (!emailSent) {
    console.error(`Failed to send magic link to ${email}`);
    return c.json({ success: false, error: 'Failed to send email. Please try again.' }, 500);
  }

  return c.json({ success: true, message: 'Magic link sent' });
});

// Verify magic link and get tokens
const verifySchema = z.object({
  token: z.string().uuid(),
  deviceId: z.string().uuid().optional(),
  deviceName: z.string().optional(),
  platform: z.string().optional(),
});

auth.post('/verify', zValidator('json', verifySchema), async c => {
  const { token, deviceId, deviceName, platform } = c.req.valid('json');
  const db = createDb(c.env);

  // Find valid magic link
  const [link] = await db
    .select()
    .from(magicLinks)
    .where(
      and(
        eq(magicLinks.token, token),
        gt(magicLinks.expiresAt, new Date().toISOString()),
        isNull(magicLinks.usedAt)
      )
    )
    .limit(1);

  if (!link) {
    return c.json({ error: 'Invalid or expired token' }, 400);
  }

  // Mark as used
  await db
    .update(magicLinks)
    .set({ usedAt: new Date().toISOString() })
    .where(eq(magicLinks.id, link.id));

  // Get user
  const [user] = await db.select().from(users).where(eq(users.id, link.userId)).limit(1);

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Register device if provided
  if (deviceId) {
    await db
      .insert(devices)
      .values({
        userId: user.id,
        deviceId,
        name: deviceName,
        platform,
      })
      .onConflictDoUpdate({
        target: [devices.userId, devices.deviceId],
        set: {
          name: deviceName,
          platform,
          lastSeenAt: new Date().toISOString(),
        },
      });
  }

  // Generate tokens
  const tokens = await createTokens(c.env.JWT_SECRET, user, deviceId);

  return c.json({
    user: { id: user.id, email: user.email },
    ...tokens,
  });
});

// Refresh access token
const refreshSchema = z.object({
  refreshToken: z.string(),
  deviceId: z.string().uuid().optional(),
});

auth.post('/refresh', zValidator('json', refreshSchema), async c => {
  const { refreshToken, deviceId } = c.req.valid('json');
  const db = createDb(c.env);

  const payload = await verifyRefreshToken(c.env.JWT_SECRET, refreshToken);

  if (!payload) {
    return c.json({ error: 'Invalid refresh token' }, 401);
  }

  // Get user
  const [user] = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Update device last seen
  if (deviceId) {
    await db
      .update(devices)
      .set({ lastSeenAt: new Date().toISOString() })
      .where(and(eq(devices.userId, user.id), eq(devices.deviceId, deviceId)));
  }

  // Generate new tokens
  const tokens = await createTokens(c.env.JWT_SECRET, user, deviceId);

  return c.json({
    user: { id: user.id, email: user.email },
    ...tokens,
  });
});

// Get current user (protected)
auth.get('/me', authMiddleware, async c => {
  const { userId } = c.get('user');
  const db = createDb(c.env);

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json({ user: { id: user.id, email: user.email } });
});

// ==========================================================================
// Device Management
// ==========================================================================

// List all devices for the authenticated user
auth.get('/devices', authMiddleware, async c => {
  const { userId, deviceId: currentDeviceId } = c.get('user');
  const db = createDb(c.env);

  const userDevices = await db
    .select({
      id: devices.id,
      deviceId: devices.deviceId,
      name: devices.name,
      platform: devices.platform,
      lastSeenAt: devices.lastSeenAt,
      createdAt: devices.createdAt,
    })
    .from(devices)
    .where(eq(devices.userId, userId))
    .orderBy(devices.lastSeenAt);

  return c.json({
    devices: userDevices.map(d => ({
      ...d,
      isCurrent: d.deviceId === currentDeviceId,
    })),
  });
});

// Remove a device (revoke access)
auth.delete('/devices/:deviceId', authMiddleware, async c => {
  const { userId, deviceId: currentDeviceId } = c.get('user');
  const targetDeviceId = c.req.param('deviceId');
  const db = createDb(c.env);

  // Prevent revoking your own device
  if (targetDeviceId === currentDeviceId) {
    return c.json({ error: 'Cannot revoke current device' }, 400);
  }

  await db
    .delete(devices)
    .where(and(eq(devices.userId, userId), eq(devices.deviceId, targetDeviceId)));

  return c.json({ success: true });
});

// Rename a device
const renameDeviceSchema = z.object({
  name: z.string().min(1).max(100),
});

auth.patch(
  '/devices/:deviceId',
  authMiddleware,
  zValidator('json', renameDeviceSchema),
  async c => {
    const { userId } = c.get('user');
    const targetDeviceId = c.req.param('deviceId');
    const { name } = c.req.valid('json');
    const db = createDb(c.env);

    await db
      .update(devices)
      .set({ name })
      .where(and(eq(devices.userId, userId), eq(devices.deviceId, targetDeviceId)));

    return c.json({ success: true });
  }
);

export { auth };
