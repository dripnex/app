# Deployment Guide

## Prerequisites

- Cloudflare account (free tier works)
- Wrangler CLI installed (`pnpm install -g wrangler`)
- Turso database created
- Secrets ready (JWT, Turso tokens, etc.)

## Environments

We use three environments:

| Environment     | Worker Name              | URL                                                      | Branch    |
| --------------- | ------------------------ | -------------------------------------------------------- | --------- |
| **Development** | `readied-api` (local)    | `http://localhost:8787`                                  | Any       |
| **Staging**     | `readied-api-staging`    | `https://readied-api-staging.your-subdomain.workers.dev` | `develop` |
| **Production**  | `readied-api-production` | `https://api.readied.app`                                | `main`    |

## First-Time Setup

### 1. Authenticate with Cloudflare

```bash
cd packages/api
wrangler login
```

This opens browser for OAuth authentication.

### 2. Create Staging Database (Turso)

```bash
# Create separate staging database
turso db create readied-staging --location aws-us-east-1

# Get URL
turso db show readied-staging
# Copy URL: libsql://readied-staging.turso.io

# Create auth token
turso db tokens create readied-staging --expiration none
# Copy token: eyJhbGci...
```

### 3. Run Migrations on Staging Database

```bash
# Point to staging database temporarily
export TURSO_DATABASE_URL="libsql://readied-staging.turso.io"
export TURSO_AUTH_TOKEN="eyJhbGci..."

pnpm db:migrate

# Verify
turso db shell readied-staging
> .tables
> SELECT * FROM users LIMIT 1;
```

### 4. Configure Staging Secrets

```bash
cd packages/api

# Set secrets for staging environment
wrangler secret put TURSO_DATABASE_URL --env staging
# Paste: libsql://readied-staging.turso.io

wrangler secret put TURSO_AUTH_TOKEN --env staging
# Paste: eyJhbGci... (staging token)

wrangler secret put JWT_SECRET --env staging
# Generate: openssl rand -base64 32
# Paste generated secret

wrangler secret put RESEND_API_KEY --env staging
# Paste: re_your_key (same as prod or test key)

wrangler secret put STRIPE_WEBHOOK_SECRET --env staging
# Paste: whsec_... (from Stripe dashboard staging webhook)
```

**Verify secrets:**

```bash
wrangler secret list --env staging
```

## Deploy to Staging

### Manual Deploy

```bash
cd packages/api

# Deploy to staging
pnpm deploy:staging
```

Or directly with wrangler:

```bash
wrangler deploy --env staging
```

**Output:**

```
✨ Uploaded readied-api-staging
✨ Published readied-api-staging (1.23 sec)
   https://readied-api-staging.your-subdomain.workers.dev
```

### Verify Deployment

```bash
# Health check
curl https://readied-api-staging.your-subdomain.workers.dev/health

# Expected:
# {"status":"ok","timestamp":"2026-01-09T..."}
```

### Test Authentication

```bash
# Request magic link
curl -X POST https://readied-api-staging.your-subdomain.workers.dev/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Check logs
wrangler tail --env staging
```

## Deploy to Production

**IMPORTANT:** Only deploy to production from `main` branch.

### 1. Merge to Main

```bash
git checkout main
git merge develop --squash
git commit -m "chore: release v0.2.0"
git push origin main
```

### 2. Configure Production Secrets

```bash
wrangler secret put TURSO_DATABASE_URL --env production
wrangler secret put TURSO_AUTH_TOKEN --env production
wrangler secret put JWT_SECRET --env production
wrangler secret put RESEND_API_KEY --env production
wrangler secret put STRIPE_WEBHOOK_SECRET --env production
```

### 3. Deploy

```bash
pnpm deploy:production
```

### 4. Configure Custom Domain

In Cloudflare Dashboard:

1. Go to Workers & Pages
2. Select `readied-api-production`
3. Settings > Triggers > Custom Domains
4. Add `api.readied.app`
5. Wait for DNS propagation (~5 min)

### 5. Update Stripe Webhook

Update webhook URL in [Stripe Dashboard](https://dashboard.stripe.com/webhooks):

- Old: `https://readied-api-staging...workers.dev/subscription/webhook`
- New: `https://api.readied.app/subscription/webhook`

## CI/CD (Optional - Future)

### GitHub Actions

```yaml
# .github/workflows/deploy-staging.yml
name: Deploy Staging
on:
  push:
    branches: [develop]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm --filter @readied/api build
      - run: pnpm wrangler deploy --env staging
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

**Setup:**

1. Create API token: Dashboard > My Profile > API Tokens
2. Add to GitHub: Settings > Secrets > `CLOUDFLARE_API_TOKEN`

## Monitoring Deployments

### View Logs

```bash
# Staging logs
wrangler tail --env staging

# Production logs
wrangler tail --env production

# Filter errors only
wrangler tail --env production --format pretty | grep ERROR
```

### Metrics

View in Cloudflare Dashboard:

- Workers & Pages > readied-api-staging > Analytics
- Requests per minute
- Error rate
- CPU time
- Duration (p50, p99)

## Rollback

### Option 1: Redeploy Previous Version

```bash
# List deployments
wrangler deployments list --env production

# Rollback to specific deployment
wrangler rollback --env production --message "Rollback due to bug"
```

### Option 2: Revert and Redeploy

```bash
git revert HEAD
git push origin main
pnpm deploy:production
```

## Troubleshooting

### "Secret not found" Error

**Cause:** Secret not configured for environment

**Solution:**

```bash
wrangler secret put MISSING_SECRET --env staging
```

### "Database connection failed"

**Cause:** Wrong Turso URL or token

**Solution:**

```bash
# Verify database
turso db show readied-staging

# Update secrets
wrangler secret put TURSO_DATABASE_URL --env staging
wrangler secret put TURSO_AUTH_TOKEN --env staging
```

### "Worker exceeded CPU limit"

**Cause:** Too much computation in single request

**Solution:**

- Review slow queries (add indexes)
- Optimize encryption/crypto operations
- Consider Durable Objects for heavy compute

### Changes not reflected after deploy

**Cause:** Browser cache or CDN cache

**Solution:**

```bash
# Bust cache
curl -X PURGE https://api.readied.app/

# Or hard refresh in browser (Cmd+Shift+R)
```

## Commands Reference

```bash
# Development
pnpm dev                          # Start local dev server
wrangler dev                      # Alternative dev server

# Deployment
pnpm deploy:staging               # Deploy to staging
pnpm deploy:production            # Deploy to production
wrangler deploy --env staging     # Direct staging deploy
wrangler deploy --env production  # Direct production deploy

# Secrets
wrangler secret list --env staging           # List secrets
wrangler secret put KEY --env staging        # Set secret
wrangler secret delete KEY --env staging     # Delete secret

# Monitoring
wrangler tail --env staging                  # View logs
wrangler deployments list --env staging      # List deployments
wrangler rollback --env staging              # Rollback deployment

# Database
pnpm db:migrate                   # Run migrations
pnpm db:generate                  # Generate migration from schema
pnpm db:studio                    # Open Drizzle Studio
```

## Production Checklist

Before deploying to production:

- [ ] All tests passing (`pnpm test`)
- [ ] Staging deployment tested
- [ ] Secrets configured in production
- [ ] Custom domain configured (`api.readied.app`)
- [ ] Stripe webhook URL updated
- [ ] Rate limiting tested
- [ ] Error tracking configured (Sentry)
- [ ] Uptime monitoring configured
- [ ] Rollback plan documented
- [ ] Team notified of deployment

## Post-Deployment Verification

```bash
# 1. Health check
curl https://api.readied.app/health

# 2. Test auth
curl -X POST https://api.readied.app/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# 3. Check rate limiting
for i in {1..15}; do
  curl -X POST https://api.readied.app/auth/magic-link \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com"}'
  echo ""
done
# Expected: First 10 succeed, then 429 Too Many Requests

# 4. Monitor logs
wrangler tail --env production
```

## Support

- **Cloudflare Docs:** https://developers.cloudflare.com/workers/
- **Wrangler CLI:** https://developers.cloudflare.com/workers/wrangler/
- **Turso Docs:** https://docs.turso.tech/
