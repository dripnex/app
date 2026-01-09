# Rate Limiting

## Overview

Rate limiting is implemented to prevent abuse and ensure fair usage of the API. We use a sliding window approach with configurable limits per endpoint.

## Implementation

### Middleware

Located at `src/middleware/rateLimit.ts`

The middleware tracks requests using:
- **Development:** In-memory Map (per-worker, resets on restart)
- **Production:** Can be upgraded to Cloudflare KV for distributed rate limiting

### Rate Limits

| Endpoint | Limit | Window | Key |
|----------|-------|--------|-----|
| `/auth/*` | 10 requests | 1 minute | IP address |
| `/sync/*` | 100 requests | 1 minute | IP address |
| General API | 300 requests | 1 minute | IP address |

### Headers

Rate limit responses include standard headers:

```http
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1704067200000
```

When limit is exceeded:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 45

{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Please try again later.",
  "retryAfter": 45
}
```

## Testing

### Test Rate Limiting Locally

```bash
# Start dev server
pnpm dev

# Make requests until rate limited
for i in {1..15}; do
  curl -X POST http://localhost:8787/auth/magic-link \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com"}'
  echo ""
done

# Expected: First 10 succeed, next 5 return 429
```

### Test with curl

```bash
# Check rate limit headers
curl -v http://localhost:8787/health 2>&1 | grep -i "x-ratelimit"
```

## Cloudflare Workers Considerations

### In-Memory Store Limitations

Current implementation uses in-memory Map:
- **Pros:** Simple, no external dependencies, fast
- **Cons:**
  - Not shared across worker instances
  - Resets on worker restart
  - Not suitable for high-traffic production

### Production Upgrade Path

For production, upgrade to Cloudflare KV:

```typescript
// Instead of Map
const rateLimitStore = new Map();

// Use KV namespace
const rateLimitKV = c.env.RATE_LIMIT_KV;

// Store entry
await rateLimitKV.put(key, JSON.stringify(entry), {
  expirationTtl: Math.ceil(windowMs / 1000),
});

// Retrieve entry
const stored = await rateLimitKV.get(key);
const entry = stored ? JSON.parse(stored) : null;
```

### Cloudflare Rate Limiting (Alternative)

Cloudflare also offers built-in rate limiting:
- Configure via dashboard
- More expensive ($$$)
- No code changes needed
- Works across all workers globally

## Bypassing Rate Limits (Development)

For local testing, you can temporarily disable:

```typescript
// src/routes/auth.ts
// Comment out this line:
// auth.use('*', authRateLimit);
```

**Important:** Never deploy with rate limiting disabled.

## Security Notes

### IP Address Detection

We use Cloudflare's `CF-Connecting-IP` header to get the real client IP:

```typescript
const ip = c.req.header('CF-Connecting-IP') ||
           c.req.header('X-Forwarded-For') ||
           'unknown';
```

**Warning:** `X-Forwarded-For` can be spoofed if not behind Cloudflare. Always prioritize `CF-Connecting-IP` when available.

### Cleanup

The in-memory store cleans up expired entries every 60 seconds to prevent memory leaks:

```typescript
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000);
```

## Monitoring

Track rate limit hits with logs:

```typescript
// Add to rateLimit.ts
if (entry.count > max) {
  console.warn(`Rate limit exceeded for ${key}: ${entry.count}/${max}`);
  // ...return 429
}
```

For production, integrate with Sentry to track abuse patterns.

## Future Improvements

1. **User-based rate limiting** - Track by userId instead of IP (requires context typing fixes)
2. **Cloudflare KV integration** - Distributed rate limiting across workers
3. **Dynamic rate limits** - Adjust limits based on subscription tier
4. **Rate limit exemptions** - Whitelist trusted IPs or users
5. **Exponential backoff** - Increase window duration for repeated violations

## References

- [Cloudflare Workers Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/kv/)
- [RFC 6585 - Additional HTTP Status Codes](https://tools.ietf.org/html/rfc6585)
- [IETF Draft - RateLimit Headers](https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-ratelimit-headers)
