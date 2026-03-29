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
import { users, magicLinks, devices, subscriptions } from '../db/schema.js';
import { createTokens, verifyRefreshToken, authMiddleware } from '../middleware/auth.js';
import { authRateLimit } from '../middleware/rateLimit.js';
import { createEmailService } from '../services/email.js';

const auth = new Hono<{ Bindings: Env }>();

// Apply rate limiting to all auth routes
auth.use('*', authRateLimit);

// Request magic link
const magicLinkSchema = z.object({
  email: z.string().email(),
  client: z.enum(['web', 'desktop']).optional().default('web'),
});

auth.post('/magic-link', zValidator('json', magicLinkSchema), async c => {
  const { email, client } = c.req.valid('json');
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

  // Send email — desktop clients get a readied:// deep link URL
  const emailService = createEmailService(c.env.RESEND_API_KEY);
  const magicLinkUrl =
    client === 'desktop'
      ? `readied://auth/verify?token=${token}`
      : `https://readied.app/auth/verify?token=${token}`;
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

  // Auto-create trial subscription for new users
  const [existingSub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, user.id))
    .limit(1);

  if (!existingSub) {
    const trialDays = 14;
    const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString();
    await db.insert(subscriptions).values({
      userId: user.id,
      status: 'trialing',
      plan: 'pro',
      trialEndsAt,
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

  // Check device still exists (revocation check)
  if (deviceId) {
    const [device] = await db
      .select({ id: devices.id })
      .from(devices)
      .where(and(eq(devices.userId, user.id), eq(devices.deviceId, deviceId)))
      .limit(1);

    if (!device) {
      return c.json({ error: 'Device has been revoked' }, 401);
    }
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

export { auth };
