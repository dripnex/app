/**
 * Readied API
 *
 * Backend API for Readied cloud sync.
 * Built with Hono for edge runtime compatibility.
 *
 * Deployable to:
 * - Cloudflare Workers
 * - Vercel Edge Functions
 * - Deno Deploy
 * - Any Node.js runtime
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { secureHeaders } from 'hono/secure-headers';
import type { Env } from './db/client.js';
import { auth } from './routes/auth.js';
import { sync } from './routes/sync.js';
import { subscription } from './routes/subscription.js';
import { newsletterRoute } from './routes/newsletter.js';
import { share } from './routes/share.js';
import { plugins } from './routes/plugins.js';
import { deviceRoutes } from './routes/devices.js';

const app = new Hono<{ Bindings: Env }>();

// Global middleware
app.use('*', logger());
app.use('*', prettyJSON());
app.use('*', secureHeaders());
app.use(
  '*',
  cors({
    origin: ['https://readied.app', 'http://localhost:5173', 'http://localhost:3000'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400,
  })
);

// Health check
app.get('/', c => {
  return c.json({
    name: 'Readied API',
    version: '0.1.0',
    status: 'healthy',
  });
});

app.get('/health', c => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount routes
app.route('/auth', auth);
app.route('/sync', sync);
app.route('/subscription', subscription);
app.route('/newsletter', newsletterRoute);
app.route('/share', share);
app.route('/plugins', plugins);
app.route('/devices', deviceRoutes);

// 404 handler
app.notFound(c => {
  return c.json({ error: 'Not Found' }, 404);
});

// Error handler
app.onError((err, c) => {
  // Let HTTPException return its proper status code (e.g. 401, 403, 404)
  if (err instanceof HTTPException) {
    // If the exception has a custom Response (with JSON body), use it directly
    const res = err.getResponse();
    if (res.headers.get('Content-Type')?.includes('application/json')) {
      return res;
    }
    // Otherwise, return a consistent JSON error response
    return c.json({ error: err.message || 'Request failed' }, err.status);
  }

  console.error('Unhandled error:', err);
  return c.json(
    {
      error: 'Internal Server Error',
      message: c.env.ENVIRONMENT === 'development' ? err.message : undefined,
    },
    500
  );
});

export default app;

// Type exports
export type { Env } from './db/client.js';
export type { AuthUser } from './middleware/auth.js';
