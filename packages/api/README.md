# @dripnex/api

Backend API for Dripnex cloud sync. Built with Hono for edge runtime compatibility.

## Features

- **Magic Link Auth** - Passwordless authentication via email
- **Cloud Sync** - Push/pull encrypted notes across devices
- **Subscription Management** - Stripe integration for Pro tier

## Deployment

Deployable to:

- Cloudflare Workers (recommended)
- Vercel Edge Functions
- Deno Deploy
- Any Node.js runtime

## Development

```bash
# Start dev server
pnpm dev

# Typecheck
pnpm typecheck

# Deploy to Cloudflare
pnpm deploy
```

## Environment Variables

Set these as secrets in your deployment platform:

| Variable                | Description                      |
| ----------------------- | -------------------------------- |
| `DATABASE_URL`          | Neon Postgres connection string  |
| `JWT_SECRET`            | Secret for signing JWTs          |
| `RESEND_API_KEY`        | API key for Resend email service |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret    |

## API Endpoints

### Auth

- `POST /auth/magic-link` - Request magic link email
- `POST /auth/verify` - Verify token and get JWT
- `POST /auth/refresh` - Refresh access token
- `GET /auth/me` - Get current user (protected)

### Sync

- `GET /sync?cursor=0` - Pull changes since cursor (protected)
- `POST /sync` - Push local changes (protected)
- `GET /sync/status` - Get sync status (protected)

### Subscription

- `POST /subscription/webhook` - Stripe webhook handler
- `GET /subscription/status` - Get subscription status (protected)
- `POST /subscription/portal` - Create Stripe portal session (protected)
