# Stripe Webhooks

## Overview

Stripe webhooks notify the API when subscription events occur (checkout completed, subscription updated, payment failed, etc.).

All webhooks are verified using HMAC-SHA256 signature verification to prevent forgery.

## Implementation

### Signature Verification

Located at `src/services/stripe.ts`

Uses Web Crypto API (`crypto.subtle`) for edge compatibility:

```typescript
const isValid = await verifyStripeSignature(requestBody, stripeSignatureHeader, webhookSecret);
```

**Security features:**

- HMAC-SHA256 signature verification
- Timestamp validation (5-minute tolerance)
- Constant-time comparison (prevents timing attacks)
- Replay attack prevention

### Supported Events

| Event                           | Handler             | Action                  |
| ------------------------------- | ------------------- | ----------------------- |
| `checkout.session.completed`    | Create subscription | User upgraded to Pro    |
| `customer.subscription.updated` | Update status       | Status/period updated   |
| `customer.subscription.deleted` | Cancel subscription | User downgraded to Free |
| `invoice.payment_failed`        | Suspend access      | Subscription inactive   |

## Local Testing

### 1. Install Stripe CLI

```bash
brew install stripe/stripe-cli/stripe
stripe login
```

### 2. Forward Webhooks to Local Server

```bash
# Start API dev server
cd packages/api
pnpm dev

# In another terminal, forward webhooks
stripe listen --forward-to localhost:8787/subscription/webhook
```

**Output:**

```
> Ready! Your webhook signing secret is whsec_abc123...
```

Copy the webhook secret (`whsec_...`) and add to `.dev.vars.local`:

```bash
STRIPE_WEBHOOK_SECRET="whsec_abc123..."
```

### 3. Trigger Test Events

```bash
# Test checkout completion
stripe trigger checkout.session.completed

# Test subscription update
stripe trigger customer.subscription.updated

# Test payment failure
stripe trigger invoice.payment_failed
```

### 4. Verify Signature Verification

```bash
# This should succeed (valid signature)
stripe trigger checkout.session.completed

# This should fail (invalid signature)
curl -X POST http://localhost:8787/subscription/webhook \
  -H "Content-Type: application/json" \
  -H "stripe-signature: t=123,v1=fake" \
  -d '{"type":"test"}'

# Expected: 401 Unauthorized with "Invalid signature"
```

## Production Setup

### 1. Configure Webhook Endpoint

1. Go to [Stripe Dashboard > Webhooks](https://dashboard.stripe.com/webhooks)
2. Click "Add endpoint"
3. Enter URL: `https://api.readied.app/subscription/webhook`
4. Select events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
5. Copy the "Signing secret" (`whsec_...`)

### 2. Add Secret to Wrangler

```bash
wrangler secret put STRIPE_WEBHOOK_SECRET
# Paste the signing secret when prompted
```

### 3. Verify Endpoint

```bash
# Send test event from dashboard
# Check Cloudflare Workers logs
wrangler tail
```

## Security

### Signature Verification Algorithm

Stripe uses HMAC-SHA256:

1. Parse `Stripe-Signature` header:

   ```
   t=1614024000,v1=abc123,v1=def456
   ```

2. Construct signed payload:

   ```
   {timestamp}.{request_body}
   ```

3. Compute HMAC-SHA256:

   ```javascript
   hmac = HMAC_SHA256(signed_payload, webhook_secret);
   ```

4. Compare with provided signatures (constant-time)

5. Validate timestamp (max 5 minutes old)

### Why Signature Verification is Critical

**Without verification:**

- Attacker can forge webhook events
- Free users can upgrade themselves to Pro
- Malicious actors can cancel subscriptions
- Payment fraud possible

**With verification:**

- Only Stripe can send valid webhooks
- Requests older than 5 minutes rejected
- Timing attacks prevented
- Replay attacks prevented

## Monitoring

### Logging

All webhook events are logged:

```typescript
console.log('Stripe webhook received', {
  type: event.type,
  id: event.id,
});
```

### Failed Verifications

Invalid signatures are logged as warnings:

```typescript
console.warn('Invalid Stripe webhook signature', {
  signature: signature.substring(0, 20) + '...',
});
```

### Stripe Dashboard

View webhook delivery history:

- [Dashboard > Webhooks > View logs](https://dashboard.stripe.com/webhooks)
- Shows delivery attempts, status codes, response times
- Can resend failed webhooks

## Error Handling

### 400 Bad Request

- Missing `stripe-signature` header
- Invalid JSON payload

### 401 Unauthorized

- Invalid signature
- Timestamp outside tolerance (>5 min)

### 500 Internal Server Error

- `STRIPE_WEBHOOK_SECRET` not configured
- Database error during processing

### Retry Strategy

Stripe automatically retries failed webhooks:

- Immediate retry
- After 1 hour
- After 6 hours
- After 24 hours

Ensure webhook endpoint returns `200 OK` to stop retries.

## Testing Checklist

- [ ] Webhook secret configured in `.dev.vars.local`
- [ ] Stripe CLI forwarding webhooks
- [ ] Test event triggers successfully
- [ ] Invalid signature returns 401
- [ ] Old timestamp (>5 min) returns 401
- [ ] Subscription created in database
- [ ] User can access sync endpoints after upgrade

## Troubleshooting

### "Invalid signature" error

**Cause:** Webhook secret mismatch

**Solution:**

1. Get secret from `stripe listen` output
2. Or from [Dashboard > Webhooks > Endpoint](https://dashboard.stripe.com/webhooks)
3. Update `.dev.vars.local` or wrangler secret

### "Webhook secret not configured" error

**Cause:** `STRIPE_WEBHOOK_SECRET` env var missing

**Solution:**

```bash
# Local
echo 'STRIPE_WEBHOOK_SECRET="whsec_..."' >> packages/api/.dev.vars.local

# Production
wrangler secret put STRIPE_WEBHOOK_SECRET
```

### Webhooks not being received

**Cause:** URL not configured in Stripe

**Solution:**

1. Check [Dashboard > Webhooks](https://dashboard.stripe.com/webhooks)
2. Verify endpoint URL is correct
3. Ensure endpoint is enabled

### Signature verification fails in production

**Cause:** Body parsed before verification

**Solution:**

- Always verify signature on **raw request body**
- Don't parse JSON before verification
- Use `c.req.text()` not `c.req.json()`

## References

- [Stripe Webhooks Documentation](https://stripe.com/docs/webhooks)
- [Webhook Signature Verification](https://stripe.com/docs/webhooks/signatures)
- [Testing Webhooks](https://stripe.com/docs/webhooks/test)
- [Stripe CLI](https://stripe.com/docs/stripe-cli)
