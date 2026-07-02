/**
 * Rate Limiting Middleware
 *
 * Uses Cloudflare's Workers Rate Limiting binding — account-global and
 * consistent across isolates — instead of a per-isolate in-memory Map (which
 * reset on every isolate and never shared state, so it did not actually limit
 * anything in production). Bindings are configured in wrangler.toml
 * (`[[unsafe.bindings]]` with `type = "ratelimit"`); the `namespace_id` is a
 * self-assigned integer (no resource to provision) and `period` must be 10 or 60s.
 *
 * - auth endpoints: 10 requests / 60s per IP  → AUTH_RL
 * - sync endpoints: 100 requests / 60s per IP → SYNC_RL
 */

import type { Context, Next } from 'hono';
import type { Env, RateLimitBinding } from '../db/client.js';

type BindingName = 'AUTH_RL' | 'SYNC_RL';

export interface RateLimitConfig {
  /** wrangler.toml ratelimit binding to enforce against. */
  binding: BindingName;
  /** Configured limit — mirrored into the X-RateLimit-Limit header. */
  max: number;
  /** Configured window in seconds — surfaced via Retry-After. */
  windowSeconds: number;
  /** Key to bucket by. Default: client IP. */
  keyGenerator?: (c: Context<{ Bindings: Env }>) => string;
  /** Response when the limit is exceeded. */
  handler?: (c: Context<{ Bindings: Env }>) => Response;
}

function clientIp(c: Context<{ Bindings: Env }>): string {
  return c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
}

export function rateLimit(config: RateLimitConfig) {
  const { binding, max, windowSeconds, keyGenerator = clientIp, handler } = config;
  const deny =
    handler ??
    ((c: Context<{ Bindings: Env }>) =>
      c.json(
        {
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: windowSeconds,
        },
        429
      ));

  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    c.header('X-RateLimit-Limit', String(max));

    const limiter = c.env[binding] as RateLimitBinding | undefined;
    // Fail open ONLY when the binding is absent — i.e. unit tests or a local
    // run without the binding configured. Deployed Workers always have it.
    if (limiter) {
      const { success } = await limiter.limit({ key: keyGenerator(c) });
      if (!success) {
        c.header('Retry-After', String(windowSeconds));
        return deny(c);
      }
    }

    await next();
  };
}

/** Strict limit for auth endpoints: 10 requests / 60s per IP. */
export const authRateLimit = rateLimit({ binding: 'AUTH_RL', max: 10, windowSeconds: 60 });

/** Moderate limit for sync endpoints: 100 requests / 60s per IP. */
export const syncRateLimit = rateLimit({ binding: 'SYNC_RL', max: 100, windowSeconds: 60 });
