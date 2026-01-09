# Readied API - Local Setup

## Prerequisites

- Node.js 18+
- pnpm 8+
- Turso CLI (`brew install tursodatabase/tap/turso`)
- Wrangler CLI (`pnpm install -g wrangler`)

## 1. Database Setup

### Create Turso Database

```bash
# Login to Turso
turso auth login

# Create database (if not exists)
turso db create readied-tomymaritano --location aws-us-east-1

# Get database URL
turso db show readied-tomymaritano
# Copy the URL (libsql://...)

# Create auth token
turso db tokens create readied-tomymaritano --expiration none
# Copy the token (eyJhbGci...)
```

### Run Migrations

```bash
cd packages/api
pnpm db:migrate
```

## 2. Local Environment Variables

Create `.dev.vars.local` (NOT tracked in git):

```bash
cp .dev.vars .dev.vars.local
```

Edit `.dev.vars.local` with your real secrets:

```bash
# Turso (from step 1)
TURSO_DATABASE_URL="libsql://your-database.turso.io"
TURSO_AUTH_TOKEN="eyJhbGci..."

# JWT Secret (generate with: openssl rand -base64 32)
JWT_SECRET="your-generated-secret-here"

# Resend (get from: https://resend.com/api-keys)
RESEND_API_KEY="re_your_key_here"

# Stripe (get from: https://dashboard.stripe.com/webhooks)
STRIPE_WEBHOOK_SECRET="whsec_your_secret_here"

# Environment
ENVIRONMENT="development"
```

**Important:** `.dev.vars.local` is gitignored. Never commit real secrets to `.dev.vars`.

## 3. Start Development Server

```bash
pnpm dev
```

API will be available at `http://localhost:8787`

## 4. Testing

### Test Magic Link Flow

```bash
curl -X POST http://localhost:8787/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

Check console for magic link (in dev mode, links are logged).

### Test Health Check

```bash
curl http://localhost:8787/health
```

## 5. Production Deployment

### Configure Secrets

```bash
# Set secrets in Cloudflare Workers
wrangler secret put TURSO_DATABASE_URL
wrangler secret put TURSO_AUTH_TOKEN
wrangler secret put JWT_SECRET
wrangler secret put RESEND_API_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
```

### Deploy

```bash
pnpm deploy
```

## 6. Troubleshooting

### "Database not found"
- Verify `TURSO_DATABASE_URL` is correct
- Run `turso db show readied-tomymaritano` to check

### "Auth token invalid"
- Token may be expired or revoked
- Create new token: `turso db tokens create readied-tomymaritano`

### "Migrations failed"
- Check database is accessible
- Verify auth token has write permissions

## Security Notes

- **Never** commit `.dev.vars.local` to git
- **Always** use `wrangler secret put` for production
- **Rotate** tokens regularly (especially if exposed)
- **Revoke** old tokens after rotation

## Commands Reference

```bash
pnpm dev              # Start dev server
pnpm deploy           # Deploy to Cloudflare Workers
pnpm db:generate      # Generate migration from schema changes
pnpm db:migrate       # Apply migrations
pnpm db:studio        # Open Drizzle Studio (DB GUI)
pnpm typecheck        # TypeScript validation
pnpm lint             # Lint code
```
