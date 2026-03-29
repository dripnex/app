# Monitoring & Observability

> **Status: Not yet implemented.** This document outlines the planned observability setup for the API.

## Sentry Setup (Planned)

### Why Sentry?

- Error tracking & stack traces
- Performance monitoring (APM)
- Release tracking
- User feedback
- Free tier: Unlimited errors, 10K transactions/mo

### Setup Steps (When Ready)

1. **Create Sentry Account**
   - Go to https://sentry.io/signup/
   - Create project: Cloudflare Workers
   - Copy DSN: `https://xxxxx@o123.ingest.sentry.io/456789`

2. **Install Toucan (Sentry SDK for Workers)**

   ```bash
   cd packages/api
   pnpm add toucan-js
   ```

3. **Add Sentry DSN to Secrets**

   ```bash
   # Local
   echo 'SENTRY_DSN="https://xxxxx@sentry.io/..."' >> .dev.vars.local

   # Production
   wrangler secret put SENTRY_DSN
   ```

4. **Integrate in index.ts**

   ```typescript
   import { Toucan } from 'toucan-js';

   app.use('*', async (c, next) => {
     const sentry = new Toucan({
       dsn: c.env.SENTRY_DSN,
       context: c.executionCtx,
       request: c.req.raw,
     });

     c.set('sentry', sentry);
     await next();
   });

   app.onError((err, c) => {
     c.get('sentry')?.captureException(err);
     return c.json({ error: 'Internal Server Error' }, 500);
   });
   ```

5. **Track Performance**

   ```typescript
   const transaction = sentry.startTransaction({
     name: 'POST /sync',
     op: 'http.server',
   });

   // ... do work

   transaction.finish();
   ```

## Cloudflare Analytics (Already Available)

Cloudflare provides basic analytics for Workers:

1. **View in Dashboard**
   - Go to Workers & Pages > readied-api > Analytics
   - Metrics: Requests, Errors, CPU time, Duration

2. **Analytics Engine (Optional - Paid)**
   - Custom metrics and logs
   - SQL-queryable via GraphQL
   - Costs: $5/mo base + usage

## Structured Logging (Simple Alternative)

If Sentry is overkill, implement structured logging:

```typescript
// src/lib/logger.ts
export function log(level: 'info' | 'warn' | 'error', message: string, meta?: object) {
  console.log(
    JSON.stringify({
      level,
      message,
      timestamp: new Date().toISOString(),
      ...meta,
    })
  );
}

// Usage
log('error', 'Auth failed', { userId, reason: 'invalid_token' });
```

View logs:

```bash
wrangler tail
```

## Uptime Monitoring

### UptimeRobot (Free)

1. Go to https://uptimerobot.com
2. Add monitor:
   - Type: HTTP(S)
   - URL: `https://api.readied.app/health`
   - Interval: 5 minutes
   - Alert: Email when down

### Alternatives

- Pingdom
- StatusCake
- Better Uptime (paid but nice status page)

## Status Page (Future)

Create public status page:

- Domain: `status.readied.app`
- Shows API health, incident history
- Options:
  - Cloudflare Pages + StatusPage.io
  - Custom Astro site
  - Better Uptime (includes status page)

## Checklist (Before Production Launch)

- [ ] Sentry account created
- [ ] Toucan-js installed and configured
- [ ] Error tracking tested
- [ ] UptimeRobot monitoring configured
- [ ] Alerts configured (email/Slack)
- [ ] Logs accessible via `wrangler tail`
- [ ] (Optional) Status page deployed

## Priority

**Low-Medium** - Not blocking launch, but important for operations.

Complete before first paying customers to ensure you can:

- Debug production issues
- Track down user-reported bugs
- Monitor API health proactively
