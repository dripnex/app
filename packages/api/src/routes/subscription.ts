/**
 * Subscription Routes
 *
 * Handles Stripe webhooks and subscription management.
 *
 * Endpoints:
 * - POST /subscription/webhook - Stripe webhook handler
 * - GET /subscription/status - Get current subscription status
 * - POST /subscription/checkout - Create Stripe checkout session
 * - POST /subscription/portal - Create Stripe portal session
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';
import { createDb, type Env } from '../db/client.js';
import { subscriptions, users, stripeEvents } from '../db/schema.js';
import { authMiddleware, type AuthUser } from '../middleware/auth.js';
import { getProductConfig } from '@dripnex/product-config';
import { verifyStripeSignature } from '../services/stripe.js';

const subscription = new Hono<{
  Bindings: Env;
  Variables: { user: AuthUser };
}>();

/**
 * Stripe webhook handler
 * Verifies webhook signature and processes events
 */
subscription.post('/webhook', async c => {
  const signature = c.req.header('stripe-signature');
  const webhookSecret = c.env.STRIPE_WEBHOOK_SECRET;

  if (!signature) {
    return c.json({ error: 'Missing stripe-signature header' }, 400);
  }

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return c.json({ error: 'Webhook secret not configured' }, 500);
  }

  const body = await c.req.text();

  // Verify webhook signature
  const isValid = await verifyStripeSignature(body, signature, webhookSecret);

  if (!isValid) {
    console.warn('Invalid Stripe webhook signature', {
      signature: signature.substring(0, 20) + '...',
    });
    return c.json({ error: 'Invalid signature' }, 401);
  }

  // Parse event
  let event: StripeEvent;
  try {
    event = JSON.parse(body) as StripeEvent;
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  if (!event.id) {
    return c.json({ error: 'Missing event id' }, 400);
  }

  const db = createDb(c.env);

  const [claimed] = await db
    .insert(stripeEvents)
    .values({
      id: event.id,
      type: event.type,
      createdAt: new Date().toISOString(),
    })
    .onConflictDoNothing()
    .returning({ id: stripeEvents.id });

  if (!claimed) {
    return c.json({ received: true, duplicate: true });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as CheckoutSession;
      const email = session.customer_email;
      const metadataUserId = session.metadata?.userId;
      if (email || metadataUserId) {
        let user = metadataUserId
          ? (
              await db.select().from(users).where(eq(users.id, metadataUserId)).limit(1)
            )[0]
          : undefined;
        if (!user && email) {
          const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
          user = existing;
        }

        if (!user && email) {
          const [created] = await db.insert(users).values({ email }).returning();
          user = created!;
        }

        if (!user) {
          break;
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

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as StripeSubscription;

      // Try update first
      const updated = await db
        .update(subscriptions)
        .set({
          status: mapStripeStatus(sub.status),
          currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
          canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
          cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(subscriptions.stripeSubscriptionId, sub.id))
        .returning({ id: subscriptions.id });

      if (updated.length === 0) {
        const [byCustomer] = sub.customer
          ? await db
              .select()
              .from(subscriptions)
              .where(eq(subscriptions.stripeCustomerId, sub.customer))
              .limit(1)
          : [];

        if (byCustomer) {
          await db
            .update(subscriptions)
            .set({
              stripeSubscriptionId: sub.id,
              status: mapStripeStatus(sub.status),
              currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
              canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
              cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(subscriptions.id, byCustomer.id));
        } else if (sub.metadata?.userId) {
          await db
            .insert(subscriptions)
            .values({
              userId: sub.metadata.userId,
              stripeCustomerId: sub.customer,
              stripeSubscriptionId: sub.id,
              status: mapStripeStatus(sub.status),
              plan: 'pro',
              currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
            })
            .onConflictDoUpdate({
              target: subscriptions.userId,
              set: {
                stripeCustomerId: sub.customer,
                stripeSubscriptionId: sub.id,
                status: mapStripeStatus(sub.status),
                plan: 'pro',
                currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
                updatedAt: new Date().toISOString(),
              },
            });
        } else {
          console.warn('Subscription created/updated but no matching row found', {
            subscriptionId: sub.id,
            customerId: sub.customer,
            event: event.type,
          });
        }
      }
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
subscription.use('/checkout', authMiddleware);
subscription.use('/portal', authMiddleware);

// Get subscription status
subscription.get('/status', async c => {
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
    stripeSubscriptionId: sub.stripeSubscriptionId,
    stripeCustomerId: sub.stripeCustomerId,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
  });
});

// Create checkout session (authenticated)
const checkoutSchema = z.object({
  plan: z.enum(['monthly', 'annual']),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

subscription.post('/checkout', zValidator('json', checkoutSchema), async c => {
  const { plan, successUrl, cancelUrl } = c.req.valid('json');
  const { userId, email } = c.get('user');

  const stripeSecretKey = c.env.STRIPE_SECRET_KEY;
  const priceMonthly = c.env.STRIPE_PRICE_MONTHLY;
  const priceAnnual = c.env.STRIPE_PRICE_ANNUAL;

  if (!stripeSecretKey || !priceMonthly || !priceAnnual) {
    console.error('Stripe configuration missing');
    return c.json({ error: 'Payment configuration error' }, 500);
  }

  try {
    const stripe = new Stripe(stripeSecretKey, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      apiVersion: '2025-01-27.acacia' as any,
    });

    const priceId = plan === 'monthly' ? priceMonthly : priceAnnual;

    const session = await stripe.checkout.sessions.create({
      customer_email: email,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl || 'https://dripnex.app/subscription/success',
      cancel_url: cancelUrl || 'https://dripnex.app/subscription/cancel',
      subscription_data: {
        metadata: { userId, email, plan },
      },
      metadata: {
        userId,
        email,
        plan,
      },
    });

    return c.json({ url: session.url });
  } catch (error) {
    console.error('Failed to create checkout session:', error);
    return c.json({ error: 'Failed to create checkout session' }, 500);
  }
});

// Create checkout session (public - for marketing site)
const publicCheckoutSchema = z.object({
  email: z.string().email(),
  plan: z.enum(['monthly', 'annual']),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

subscription.post('/checkout/public', zValidator('json', publicCheckoutSchema), async c => {
  const { email, plan, successUrl, cancelUrl } = c.req.valid('json');
  const db = createDb(c.env);

  // Find or create user
  const [existingUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  let user = existingUser;

  if (!user) {
    const [created] = await db.insert(users).values({ email }).returning();
    user = created!;
  }

  const stripeSecretKey = c.env.STRIPE_SECRET_KEY;
  const priceMonthly = c.env.STRIPE_PRICE_MONTHLY;
  const priceAnnual = c.env.STRIPE_PRICE_ANNUAL;

  if (!stripeSecretKey || !priceMonthly || !priceAnnual) {
    console.error('Stripe configuration missing');
    return c.json({ error: 'Payment configuration error' }, 500);
  }

  try {
    const stripe = new Stripe(stripeSecretKey, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      apiVersion: '2025-01-27.acacia' as any,
    });

    const priceId = plan === 'monthly' ? priceMonthly : priceAnnual;

    const session = await stripe.checkout.sessions.create({
      customer_email: email,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl || 'https://dripnex.app/subscription/success',
      cancel_url: cancelUrl || 'https://dripnex.app/subscribe',
      subscription_data: {
        trial_period_days: getProductConfig().trialDays,
        metadata: {
          userId: user.id.toString(),
          email,
          plan,
        },
      },
      metadata: {
        userId: user.id.toString(),
        email,
        plan,
      },
    });

    return c.json({ url: session.url });
  } catch (error) {
    console.error('Failed to create public checkout session:', error);
    return c.json({ error: 'Failed to create checkout session' }, 500);
  }
});

// Create portal session for subscription management
const portalSchema = z.object({
  returnUrl: z.string().url(),
});

subscription.post('/portal', zValidator('json', portalSchema), async c => {
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

  const stripeSecretKey = c.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    console.error('Stripe configuration missing');
    return c.json({ error: 'Payment configuration error' }, 500);
  }

  try {
    const stripe = new Stripe(stripeSecretKey, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      apiVersion: '2025-01-27.acacia' as any,
    });

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: returnUrl,
    });

    return c.json({ url: session.url });
  } catch (error) {
    console.error('Failed to create portal session:', error);
    return c.json({ error: 'Failed to create portal session' }, 500);
  }
});

// Helper types for Stripe events
interface StripeEvent {
  id: string;
  type: string;
  data: { object: unknown };
}

interface CheckoutSession {
  customer: string;
  customer_email: string | null;
  subscription: string;
  metadata?: { userId?: string };
}

interface StripeSubscription {
  id: string;
  customer: string;
  status: string;
  current_period_end: number;
  canceled_at: number | null;
  cancel_at_period_end: boolean;
  metadata?: { userId?: string };
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
