# Readied API Reference

**Base URL:** `https://api.readied.app`

**Auth:** JWT Bearer token in `Authorization: Bearer <token>` header. Access tokens expire in 15 minutes; refresh tokens in 7 days.

**Rate limiting:** Applied to auth and sync routes.

---

## Health

### `GET /`

Returns API metadata. No auth.

**Response:** `{ name, version, status }`

### `GET /health`

Health check. No auth.

**Response:** `{ status: "ok", timestamp }`

---

## Auth (`/auth`)

All auth routes are rate-limited. Magic link flow: request link, verify token, receive JWT pair.

### `POST /auth/magic-link`

Send a magic link email. No auth.

| Field   | Type   | Required |
| ------- | ------ | -------- |
| `email` | string | yes      |

**Response:** `{ success: true, message: "Magic link sent" }`

**Errors:** `500` email send failure.

### `POST /auth/verify`

Exchange magic link token for JWT tokens. No auth.

| Field        | Type   | Required |
| ------------ | ------ | -------- |
| `token`      | uuid   | yes      |
| `deviceId`   | uuid   | no       |
| `deviceName` | string | no       |
| `platform`   | string | no       |

**Response:**

```json
{
  "user": { "id": "...", "email": "..." },
  "accessToken": "...",
  "refreshToken": "..."
}
```

**Errors:** `400` invalid/expired token, `404` user not found.

### `POST /auth/refresh`

Refresh an expired access token. No auth (uses refresh token in body).

| Field          | Type   | Required |
| -------------- | ------ | -------- |
| `refreshToken` | string | yes      |
| `deviceId`     | uuid   | no       |

**Response:** Same as `/auth/verify`.

**Errors:** `401` invalid refresh token or revoked device, `404` user not found.

### `GET /auth/me`

Get current user. **Auth required.**

**Response:** `{ user: { id, email } }`

**Errors:** `401` unauthorized, `404` user not found.

---

## Sync (`/sync`)

All sync routes require auth and an active/trialing Pro subscription. Rate-limited.

### `GET /sync`

Pull note changes since cursor. **Auth required.**

| Query Param | Type | Default | Constraints |
| ----------- | ---- | ------- | ----------- |
| `cursor`    | int  | 0       | >= 0        |
| `limit`     | int  | 50      | 1-100       |

**Response:**

```json
{
  "changes": [
    { "id", "noteId", "version", "operation", "encryptedData", "deviceId", "createdAt" }
  ],
  "cursor": 42,
  "hasMore": false
}
```

**Errors:** `403` no Pro subscription.

### `POST /sync`

Push local note changes. **Auth required.**

| Field                     | Type                                   | Required          |
| ------------------------- | -------------------------------------- | ----------------- |
| `deviceId`                | uuid                                   | yes               |
| `changes`                 | array                                  | yes (1-100 items) |
| `changes[].noteId`        | string                                 | yes               |
| `changes[].operation`     | `"create"` \| `"update"` \| `"delete"` | yes               |
| `changes[].encryptedData` | string \| null                         | no                |
| `changes[].localVersion`  | int                                    | no                |

**Response:**

```json
{
  "results": [{ "noteId": "...", "version": 5, "status": "applied" }],
  "cursor": 5
}
```

A result with `"status": "conflict"` includes `serverVersion` indicating the conflicting version.

**Errors:** `403` no Pro subscription.

### `GET /sync/status`

Get sync status for current device. **Auth required.**

**Response:** `{ enabled, plan, cursor, totalChanges }`

### `GET /sync/notebooks`

Pull notebook changes since cursor. **Auth required.**

Same query params as `GET /sync`. Returns `notebookId` instead of `noteId`, and `data` (JSON string) instead of `encryptedData`.

**Errors:** `403` no Pro subscription.

### `POST /sync/notebooks`

Push notebook changes. **Auth required.** Validates tree integrity (max depth 2, valid parentId, no cycles).

| Field                    | Type                                   | Required          |
| ------------------------ | -------------------------------------- | ----------------- |
| `deviceId`               | uuid                                   | yes               |
| `changes`                | array                                  | yes (1-100 items) |
| `changes[].notebookId`   | string                                 | yes               |
| `changes[].operation`    | `"create"` \| `"update"` \| `"delete"` | yes               |
| `changes[].data`         | string (JSON) \| null                  | no                |
| `changes[].localVersion` | int                                    | no                |

**Response:** `{ results: [{ notebookId, version, status }], cursor }`

**Errors:** `403` no Pro subscription, `422` tree validation failed (returns `{ error, detail, notebookId }`).

### `GET /sync/tags`

Pull tag changes since cursor. **Auth required.**

Same query params as `GET /sync`. Returns `tagId` and `data` (JSON: `{ name, color }`).

**Errors:** `403` no Pro subscription.

### `POST /sync/tags`

Push tag changes. **Auth required.**

| Field                    | Type                                   | Required          |
| ------------------------ | -------------------------------------- | ----------------- |
| `deviceId`               | uuid                                   | yes               |
| `changes`                | array                                  | yes (1-100 items) |
| `changes[].tagId`        | uuid                                   | yes               |
| `changes[].operation`    | `"create"` \| `"update"` \| `"delete"` | yes               |
| `changes[].data`         | string (JSON) \| null                  | no                |
| `changes[].localVersion` | int                                    | no                |

Tag `data` must include a `name` string for create/update operations.

**Response:** `{ results: [{ tagId, version, status }], cursor }`

**Errors:** `403` no Pro subscription, `422` tag data missing `name`.

---

## Subscription (`/subscription`)

### `POST /subscription/webhook`

Stripe webhook handler. No auth (verified via `stripe-signature` header).

Processes events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.

**Response:** `{ received: true }`

**Errors:** `400` missing signature or invalid JSON, `401` invalid signature.

### `GET /subscription/status`

Get current subscription status. **Auth required.**

**Response:**

```json
{
  "plan": "pro",
  "status": "active",
  "syncEnabled": true,
  "currentPeriodEnd": "...",
  "trialEndsAt": "...",
  "canceledAt": null,
  "stripeSubscriptionId": "...",
  "stripeCustomerId": "...",
  "cancelAtPeriodEnd": false
}
```

Returns `{ plan: "free", status: "inactive", syncEnabled: false }` if no subscription exists.

### `POST /subscription/checkout`

Create a Stripe Checkout session. **Auth required.**

| Field        | Type                      | Required                                                 |
| ------------ | ------------------------- | -------------------------------------------------------- |
| `plan`       | `"monthly"` \| `"annual"` | yes                                                      |
| `successUrl` | URL                       | no (default: `https://readied.app/subscription/success`) |
| `cancelUrl`  | URL                       | no (default: `https://readied.app/subscription/cancel`)  |

**Response:** `{ url: "https://checkout.stripe.com/..." }`

**Errors:** `500` Stripe config missing or session creation failed.

### `POST /subscription/checkout/public`

Create a Stripe Checkout session without auth (for marketing site). Includes 14-day free trial.

| Field        | Type                      | Required |
| ------------ | ------------------------- | -------- |
| `email`      | email                     | yes      |
| `plan`       | `"monthly"` \| `"annual"` | yes      |
| `successUrl` | URL                       | no       |
| `cancelUrl`  | URL                       | no       |

**Response:** `{ url: "https://checkout.stripe.com/..." }`

### `POST /subscription/portal`

Create a Stripe Customer Portal session for subscription management. **Auth required.**

| Field       | Type | Required |
| ----------- | ---- | -------- |
| `returnUrl` | URL  | yes      |

**Response:** `{ url: "https://billing.stripe.com/..." }`

**Errors:** `404` no subscription found, `500` Stripe error.

---

## Share (`/share`)

### `POST /share`

Create or update a shared note. **Auth required.** Upserts on `(userId, noteId)`.

| Field     | Type   | Required           |
| --------- | ------ | ------------------ |
| `noteId`  | string | yes                |
| `title`   | string | no (default: `""`) |
| `content` | string | no (default: `""`) |

**Response:** `{ slug: "a1b2c3d4", url: "https://readied.app/shared?slug=a1b2c3d4" }`

### `GET /share/:slug`

Get a shared note by slug. **No auth** (public).

**Response:** `{ title, content, createdAt, updatedAt }`

**Errors:** `404` not found or not public.

### `DELETE /share/:slug`

Delete a shared note. **Auth required** (owner only).

**Response:** `{ success: true }`

**Errors:** `404` not found or not owner.

---

## Plugins (`/plugins`)

Public plugin catalog. No auth required.

### `GET /plugins`

List published plugins. Filterable and sortable.

| Query Param | Type                                  | Default      |
| ----------- | ------------------------------------- | ------------ |
| `category`  | string                                | all          |
| `search`    | string                                | -            |
| `sort`      | `"popular"` \| `"newest"` \| `"name"` | `"popular"`  |
| `limit`     | int                                   | 50 (max 100) |
| `offset`    | int                                   | 0            |

**Response:** `{ plugins: [...], total }`

### `GET /plugins/:slug`

Get a single plugin by slug.

**Response:** Full plugin object with parsed `tags` array.

**Errors:** `404` plugin not found.

---

## Devices (`/devices`)

All device routes require auth.

### `GET /devices`

List all registered devices for current user. Returns `isCurrent: true` for the requesting device.

**Response:**

```json
{
  "devices": [
    { "id", "deviceId", "name", "platform", "isCurrent", "lastSeenAt", "createdAt" }
  ]
}
```

### `POST /devices/revoke-others`

Revoke all devices except the current one. Requires `deviceId` in JWT.

**Response:** `{ success: true, revokedCount: 2 }`

**Errors:** `400` no current device ID in token.

### `DELETE /devices/:deviceId`

Revoke a single device. Also removes its sync cursor.

**Response:** `{ success: true }`

**Errors:** `404` device not found.

### `PATCH /devices/:deviceId`

Rename a device.

| Field  | Type   | Required | Constraints |
| ------ | ------ | -------- | ----------- |
| `name` | string | yes      | 1-100 chars |

**Response:** `{ success: true }`

**Errors:** `404` device not found.

---

## Newsletter (`/newsletter`)

Public endpoints. No auth required.

### `POST /newsletter/subscribe`

Subscribe to newsletter. Sends welcome email.

| Field   | Type  | Required |
| ------- | ----- | -------- |
| `email` | email | yes      |

**Response:** `{ success: true, message: "Subscribed successfully" }`

### `POST /newsletter/unsubscribe`

Unsubscribe from newsletter.

| Field   | Type  | Required |
| ------- | ----- | -------- |
| `email` | email | yes      |

**Response:** `{ success: true, message: "Unsubscribed successfully" }`

### `GET /newsletter/status/:email`

Check subscription status for an email.

**Response:** `{ subscribed: true, status: "subscribed", subscribedAt: "..." }`

**Errors:** `400` invalid email.

---

## Common Error Responses

All errors return JSON:

```json
{ "error": "Error message" }
```

| Code | Meaning                                         |
| ---- | ----------------------------------------------- |
| 400  | Bad request / validation error                  |
| 401  | Unauthorized (missing/invalid/expired token)    |
| 403  | Forbidden (e.g., no Pro subscription for sync)  |
| 404  | Resource not found                              |
| 422  | Unprocessable entity (validation logic failure) |
| 500  | Internal server error                           |
