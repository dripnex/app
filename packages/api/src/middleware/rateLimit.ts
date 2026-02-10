/**
 * Rate Limiting Middleware
 *
 * Implements sliding window rate limiting to prevent abuse.
 * Uses in-memory storage for development, can be upgraded to Cloudflare KV for production.
 *
 * Strategy:
 * - Public endpoints (auth): Rate limit by IP address
 * - Authenticated endpoints (sync): Rate limit by user ID
 */

import type { Context, Next } from 'hono';
import type { Env } from '../db/client.js';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store (per-worker, not shared)
// For production, upgrade to Cloudflare KV for distributed rate limiting
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Cleanup expired entries from rate limit store
 * Called inline during rate limit checks to avoid global scope timers
 */
function cleanupExpiredEntries() {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}

export interface RateLimitOptions {
  /**
   * Maximum number of requests allowed in the window
   */
  max: number;

  /**
   * Window duration in milliseconds
   */
  windowMs: number;

  /**
   * Key generator function
   * Default: Uses IP address from CF-Connecting-IP header
   */
  keyGenerator?: (c: Context<{ Bindings: Env }>) => string;

  /**
   * Handler when rate limit is exceeded
   */
  handler?: (c: Context<{ Bindings: Env }>) => Response;
}

/**
 * Rate limiting middleware factory
 */
export function rateLimit(options: RateLimitOptions) {
  const {
    max,
    windowMs,
    keyGenerator = c => {
      // Use Cloudflare's CF-Connecting-IP header (real client IP)
      const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
      return ip;
    },
    handler = c => {
      return c.json(
        {
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil(windowMs / 1000),
        },
        429
      );
    },
  } = options;

  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    // Cleanup expired entries periodically
    cleanupExpiredEntries();

    const key = keyGenerator(c);
    const now = Date.now();

    // Get or create rate limit entry
    let entry = rateLimitStore.get(key);

    if (!entry || entry.resetAt < now) {
      // Create new window
      entry = {
        count: 0,
        resetAt: now + windowMs,
      };
      rateLimitStore.set(key, entry);
    }

    // Increment request count
    entry.count++;

    // Check if limit exceeded
    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      c.header('Retry-After', retryAfter.toString());
      c.header('X-RateLimit-Limit', max.toString());
      c.header('X-RateLimit-Remaining', '0');
      c.header('X-RateLimit-Reset', entry.resetAt.toString());
      return handler(c);
    }

    // Add rate limit headers
    c.header('X-RateLimit-Limit', max.toString());
    c.header('X-RateLimit-Remaining', Math.max(0, max - entry.count).toString());
    c.header('X-RateLimit-Reset', entry.resetAt.toString());

    await next();
  };
}

/**
 * Pre-configured rate limiters
 */

/**
 * Strict rate limit for authentication endpoints
 * 10 requests per minute per IP
 */
export const authRateLimit = rateLimit({
  max: 10,
  windowMs: 60 * 1000, // 1 minute
});

/**
 * Moderate rate limit for sync endpoints
 * 100 requests per minute per IP
 *
 * Note: Uses IP-based rate limiting for simplicity.
 * For user-based rate limiting, upgrade to Cloudflare KV storage.
 */
export const syncRateLimit = rateLimit({
  max: 100,
  windowMs: 60 * 1000, // 1 minute
});

/**
 * Lenient rate limit for general API endpoints
 * 300 requests per minute per IP
 */
export const generalRateLimit = rateLimit({
  max: 300,
  windowMs: 60 * 1000, // 1 minute
});
