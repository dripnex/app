# @dripnex/licensing

License and subscription verification helpers.

## Subscription envelope (Ed25519)

The desktop app caches its subscription state on disk. To prevent users from editing that file to grant themselves a paid plan, the **server signs every subscription payload with an Ed25519 private key**. The desktop verifies with an embedded public key. There is **no shared secret** on the client.

### Wire format

The server returns (and the client persists) a `SignedSubscriptionEnvelope`:

```ts
{
  payload: {
    payloadVersion: 1,
    subscription: { /* SubscriptionInfo — id, customer, plan, status, period... */ },
    issuedAt: "2026-06-08T12:00:00.000Z",  // when the server signed this
    ttlSeconds?: 3600                      // optional max age the server wants the client to honour
  },
  signature: "<base64 Ed25519 signature>"
}
```

The signature is computed over `canonicalJson(payload)` — a deterministic, sorted-key JSON encoding (see `canonicalJson` in `validator.ts`). Both sides MUST canonicalize identically, otherwise verification will fail even when the data is unchanged.

### Server side (signing)

```ts
import { signSubscriptionPayload } from '@dripnex/licensing';

const envelope = await signSubscriptionPayload(
  {
    payloadVersion: 1,
    subscription: subscriptionInfoFromStripe,
    issuedAt: new Date().toISOString(),
    ttlSeconds: 3600, // optional
  },
  process.env.LICENSE_SIGNING_PRIVATE_KEY! // 32-byte Ed25519 private key, hex
);

return envelope;
```

- The private key MUST live only on the server. Never commit it. Rotate by generating a new keypair (`generateKeyPair`), updating the embedded public key in the desktop, and shipping a new release.
- `issuedAt` is mandatory — replay protection on the client uses it.

### Client side (verification)

```ts
import { verifySubscriptionSignature } from '@dripnex/licensing';

const result = await verifySubscriptionSignature(envelope, {
  publicKey: SUBSCRIPTION_PUBLIC_KEY, // embedded in the desktop
  // maxAgeSeconds: 24 * 3600,          // optional; otherwise honours ttlSeconds
});

if (!result.valid) {
  // Treat as not-subscribed. Log result.error.
}
```

### Embedded public key

`DEFAULT_SUBSCRIPTION_PUBLIC_KEY` in `validator.ts` is a **placeholder** (`0000…`). It MUST be replaced with the actual server public key before shipping signed subscriptions. Callers may also pass `config.publicKey` explicitly, which is the form used by every internal consumer.

### Replay & clock skew

`verifySubscriptionSignature` rejects:

- Envelopes older than `maxAgeSeconds` (defaults to `payload.ttlSeconds`, otherwise 7 days).
- Envelopes whose `issuedAt` is more than 60 seconds in the future (tolerates small clock skew between client and server).

### What is NOT signed

- **Trial state** (`trial.json`) is created entirely on the client when the user first starts a trial. There is no server-side trial registration. A determined user can extend their trial by editing the file. This is accepted: the trial is best-effort and the goal is to deter casual tampering, not stop a motivated attacker. Subscription is the real boundary.
- The **legacy license file** (`LicenseFile`) has its own signature scheme via `validateLicense` / `signLicense`, kept for backwards compatibility while the subscription model phases it out.

## Rolling the signing key

1. Generate a new keypair with `generateKeyPair()`.
2. Ship a desktop release with the new public key embedded.
3. Once enough clients have updated, switch the server to sign with the new private key.
4. Old clients with the previous public key will fail verification and treat users as not-subscribed until they update.

Plan windowed rollouts accordingly — there is no client-side multi-key acceptance today.
