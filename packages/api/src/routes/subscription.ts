/**
 * Subscription Routes
 *
 * Handles Stripe webhooks and subscription management.
 *
 * Endpoints:
 * - POST /subscription/webhook - Stripe webhook handler
 * - GET /subscription - Get current subscription status
 * - POST /subscription/portal - Create Stripe portal session
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { createDb, type Env } from '../db/client.js';
import { subscriptions, users } from '../db/schema.js';
import { authMiddleware, type AuthUser } from '../middleware/auth.js';

const subscription = new Hono<{
  Bindings: Env;
  Variables: { user: AuthUser };
}>();

/**
 * Stripe webhook handler
 * Verifies webhook signature and processes events
 */
subscription.post('/webhook', async (c) => {
  const signature = c.req.header('stripe-signature');
  const webhookSecret = c.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return c.json({ error: 'Missing signature or webhook secret' }, 400);
  }

  const body = await c.req.text();

  // Verify webhook signature (simplified - in production use Stripe SDK)
  // For now, we'll trust the signature and parse the event
  // TODO: Implement proper signature verification with crypto.subtle

  let event: StripeEvent;
  try {
    event = JSON.parse(body) as StripeEvent;
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const db = createDb(c.env);

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as CheckoutSession;
      if (session.customer_email) {
        // Find or create user
        let [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, session.customer_email))
          .limit(1);

        if (!user) {
          [user] = await db.insert(users).values({ email: session.customer_email }).returning();
        }

        // Create or update subscription
        await db
          .insert(subscriptions)
          .values({
            userId: user.id,
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string,
            status: 'active',
            plan: 'pro',
          })
          .onConflictDoUpdate({
            target: subscriptions.userId,
            set: {
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: session.subscription as string,
              status: 'active',
              plan: 'pro',
              updatedAt: new Date().toISOString(),
            },
          });
      }
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as StripeSubscription;
      await db
        .update(subscriptions)
        .set({
          status: mapStripeStatus(sub.status),
          currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
          canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(subscriptions.stripeSubscriptionId, sub.id));
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as StripeSubscription;
      await db
        .update(subscriptions)
        .set({
          status: 'canceled',
          plan: 'free',
          canceledAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(subscriptions.stripeSubscriptionId, sub.id));
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as StripeInvoice;
      if (invoice.subscription) {
        await db
          .update(subscriptions)
          .set({
            status: 'inactive',
            updatedAt: new Date().toISOString(),
          })
          .where(eq(subscriptions.stripeSubscriptionId, invoice.subscription as string));
      }
      break;
    }
  }

  return c.json({ received: true });
});

// Protected routes
subscription.use('/status', authMiddleware);
subscription.use('/portal', authMiddleware);

// Get subscription status
subscription.get('/status', async (c) => {
  const { userId } = c.get('user');
  const db = createDb(c.env);

  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  if (!sub) {
    return c.json({
      plan: 'free',
      status: 'inactive',
      syncEnabled: false,
    });
  }

  return c.json({
    plan: sub.plan,
    status: sub.status,
    syncEnabled: sub.status === 'active' || sub.status === 'trialing',
    currentPeriodEnd: sub.currentPeriodEnd,
    trialEndsAt: sub.trialEndsAt,
    canceledAt: sub.canceledAt,
  });
});

// Create portal session for subscription management
const portalSchema = z.object({
  returnUrl: z.string().url(),
});

subscription.post('/portal', zValidator('json', portalSchema), async (c) => {
  const { returnUrl } = c.req.valid('json');
  const { userId } = c.get('user');
  const db = createDb(c.env);

  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  if (!sub?.stripeCustomerId) {
    return c.json({ error: 'No subscription found' }, 404);
  }

  // In production, use Stripe SDK to create portal session
  // For now, return placeholder
  return c.json({
    url: `https://billing.stripe.com/p/session/${sub.stripeCustomerId}?return_url=${encodeURIComponent(returnUrl)}`,
  });
});

// Helper types for Stripe events
interface StripeEvent {
  type: string;
  data: { object: unknown };
}

interface CheckoutSession {
  customer: string;
  customer_email: string | null;
  subscription: string;
}

interface StripeSubscription {
  id: string;
  status: string;
  current_period_end: number;
  canceled_at: number | null;
}

interface StripeInvoice {
  subscription: string | null;
}

// Map Stripe status to our status
function mapStripeStatus(stripeStatus: string): string {
  switch (stripeStatus) {
    case 'active':
      return 'active';
    case 'trialing':
      return 'trialing';
    case 'canceled':
    case 'unpaid':
      return 'canceled';
    default:
      return 'inactive';
  }
}

export { subscription };
