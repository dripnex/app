/**
 * Newsletter Routes
 *
 * Public endpoints for newsletter subscription management.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { createDb, type Env } from '../db/client.js';
import { newsletter } from '../db/schema.js';
import { createEmailService } from '../services/email.js';

const newsletterRoute = new Hono<{ Bindings: Env }>();

// Subscribe to newsletter
const subscribeSchema = z.object({
  email: z.string().email(),
});

newsletterRoute.post('/subscribe', zValidator('json', subscribeSchema), async c => {
  const { email } = c.req.valid('json');
  const db = createDb(c.env);

  try {
    // Check if already subscribed
    const [existing] = await db
      .select()
      .from(newsletter)
      .where(eq(newsletter.email, email))
      .limit(1);

    if (existing) {
      if (existing.status === 'subscribed') {
        return c.json({ success: true, message: 'Already subscribed' });
      }

      // Re-subscribe if previously unsubscribed
      await db
        .update(newsletter)
        .set({
          status: 'subscribed',
          subscribedAt: new Date().toISOString(),
          unsubscribedAt: null,
        })
        .where(eq(newsletter.email, email));
    } else {
      // Insert new subscriber
      await db.insert(newsletter).values({
        email,
        status: 'subscribed',
        subscribedAt: new Date().toISOString(),
      });
    }

    // Send welcome email
    const emailService = createEmailService(c.env.RESEND_API_KEY);
    await emailService.sendWelcomeEmail(email);

    return c.json({ success: true, message: 'Subscribed successfully' });
  } catch (error) {
    console.error('Newsletter subscription error:', error);
    return c.json({ error: 'Failed to subscribe' }, 500);
  }
});

// Unsubscribe from newsletter
newsletterRoute.post('/unsubscribe', zValidator('json', subscribeSchema), async c => {
  const { email } = c.req.valid('json');
  const db = createDb(c.env);

  try {
    const [existing] = await db
      .select()
      .from(newsletter)
      .where(eq(newsletter.email, email))
      .limit(1);

    if (!existing) {
      return c.json({ success: true, message: 'Email not found' });
    }

    await db
      .update(newsletter)
      .set({
        status: 'unsubscribed',
        unsubscribedAt: new Date().toISOString(),
      })
      .where(eq(newsletter.email, email));

    return c.json({ success: true, message: 'Unsubscribed successfully' });
  } catch (error) {
    console.error('Newsletter unsubscribe error:', error);
    return c.json({ error: 'Failed to unsubscribe' }, 500);
  }
});

// Get newsletter subscription status
newsletterRoute.get('/status/:email', async c => {
  const email = c.req.param('email');
  const db = createDb(c.env);

  if (!email || !z.string().email().safeParse(email).success) {
    return c.json({ error: 'Invalid email' }, 400);
  }

  try {
    const [subscriber] = await db
      .select()
      .from(newsletter)
      .where(eq(newsletter.email, email))
      .limit(1);

    if (!subscriber) {
      return c.json({ subscribed: false });
    }

    return c.json({
      subscribed: subscriber.status === 'subscribed',
      status: subscriber.status,
      subscribedAt: subscriber.subscribedAt,
    });
  } catch (error) {
    console.error('Newsletter status error:', error);
    return c.json({ error: 'Failed to get status' }, 500);
  }
});

export { newsletterRoute };
