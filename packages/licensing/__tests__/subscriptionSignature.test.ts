import { describe, it, expect } from 'vitest';
import {
  canonicalJson,
  signSubscriptionPayload,
  verifySubscriptionSignature,
  generateKeyPair,
} from '../src/validator.js';
import type { SignedSubscriptionPayload, SubscriptionInfo } from '../src/types.js';

const futureIso = (offsetMs: number): string => new Date(Date.now() + offsetMs).toISOString();

function makeSubscription(overrides: Partial<SubscriptionInfo> = {}): SubscriptionInfo {
  return {
    subscriptionId: 'sub_test_abc',
    customerId: 'cus_test_xyz',
    email: 'user@example.com',
    plan: 'monthly',
    status: 'active',
    currentPeriodStart: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    currentPeriodEnd: futureIso(30 * 24 * 60 * 60 * 1000),
    cancelAtPeriodEnd: false,
    ...overrides,
  };
}

function makePayload(
  overrides: Partial<SignedSubscriptionPayload> = {}
): SignedSubscriptionPayload {
  return {
    payloadVersion: 1,
    subscription: makeSubscription(),
    issuedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('canonicalJson', () => {
  it('emits sorted-key JSON regardless of insertion order', () => {
    const a = canonicalJson({ b: 2, a: 1 });
    const b = canonicalJson({ a: 1, b: 2 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":1,"b":2}');
  });

  it('recurses into nested objects', () => {
    const a = canonicalJson({ outer: { z: 1, a: 2 } });
    expect(a).toBe('{"outer":{"a":2,"z":1}}');
  });

  it('keeps arrays in their original order', () => {
    expect(canonicalJson([3, 1, 2])).toBe('[3,1,2]');
  });

  it('drops undefined fields like JSON.stringify does', () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe('{"a":1}');
  });

  it('handles primitives', () => {
    expect(canonicalJson(null)).toBe('null');
    expect(canonicalJson(42)).toBe('42');
    expect(canonicalJson('x')).toBe('"x"');
    expect(canonicalJson(true)).toBe('true');
  });
});

describe('signSubscriptionPayload + verifySubscriptionSignature', () => {
  it('sign then verify round-trips with a fresh keypair', async () => {
    const keys = await generateKeyPair();
    const payload = makePayload();
    const envelope = await signSubscriptionPayload(payload, keys.privateKey);

    expect(envelope.signature).toBeTruthy();
    expect(envelope.payload).toEqual(payload);

    const result = await verifySubscriptionSignature(envelope, { publicKey: keys.publicKey });
    expect(result.valid).toBe(true);
    expect(result.subscription).toEqual(payload.subscription);
  });

  it('rejects an envelope signed with a different key', async () => {
    const signer = await generateKeyPair();
    const other = await generateKeyPair();
    const envelope = await signSubscriptionPayload(makePayload(), signer.privateKey);

    const result = await verifySubscriptionSignature(envelope, { publicKey: other.publicKey });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Signature verification failed/);
  });

  it('rejects a tampered payload', async () => {
    const keys = await generateKeyPair();
    const envelope = await signSubscriptionPayload(makePayload(), keys.privateKey);

    const tampered = {
      ...envelope,
      payload: {
        ...envelope.payload,
        subscription: {
          ...envelope.payload.subscription,
          email: 'attacker@example.com',
        },
      },
    };

    const result = await verifySubscriptionSignature(tampered, { publicKey: keys.publicKey });
    expect(result.valid).toBe(false);
  });

  it('rejects unsupported payloadVersion', async () => {
    const keys = await generateKeyPair();
    const envelope = await signSubscriptionPayload(
      // @ts-expect-error — intentionally bad version
      makePayload({ payloadVersion: 99 }),
      keys.privateKey
    );
    const result = await verifySubscriptionSignature(envelope, { publicKey: keys.publicKey });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/payload version/i);
  });

  it('rejects an envelope older than maxAgeSeconds', async () => {
    const keys = await generateKeyPair();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const envelope = await signSubscriptionPayload(
      makePayload({ issuedAt: sevenDaysAgo }),
      keys.privateKey
    );
    const result = await verifySubscriptionSignature(envelope, {
      publicKey: keys.publicKey,
      maxAgeSeconds: 60 * 60, // 1 hour
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/older than max age/);
  });

  it('honours per-envelope ttlSeconds when caller does not override', async () => {
    const keys = await generateKeyPair();
    const issuedAt = new Date(Date.now() - 10 * 1000).toISOString();
    const envelope = await signSubscriptionPayload(
      makePayload({ issuedAt, ttlSeconds: 5 }),
      keys.privateKey
    );
    const result = await verifySubscriptionSignature(envelope, { publicKey: keys.publicKey });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/older than max age/);
  });

  it('rejects envelopes timestamped far in the future', async () => {
    const keys = await generateKeyPair();
    const inFiveMinutes = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const envelope = await signSubscriptionPayload(
      makePayload({ issuedAt: inFiveMinutes }),
      keys.privateKey
    );
    const result = await verifySubscriptionSignature(envelope, { publicKey: keys.publicKey });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/from the future/);
  });

  it('uses the injectable clock to make timing tests deterministic', async () => {
    const keys = await generateKeyPair();
    const issuedAt = '2026-01-01T00:00:00.000Z';
    const envelope = await signSubscriptionPayload(makePayload({ issuedAt }), keys.privateKey);
    const result = await verifySubscriptionSignature(envelope, {
      publicKey: keys.publicKey,
      // Set the clock 30 seconds after issuedAt — well inside any sensible TTL.
      nowMs: new Date(issuedAt).getTime() + 30 * 1000,
    });
    expect(result.valid).toBe(true);
  });

  it('rejects an inactive subscription even with a valid signature', async () => {
    const keys = await generateKeyPair();
    const envelope = await signSubscriptionPayload(
      makePayload({
        subscription: makeSubscription({
          status: 'canceled',
          currentPeriodEnd: new Date(Date.now() - 1).toISOString(),
        }),
      }),
      keys.privateKey
    );
    const result = await verifySubscriptionSignature(envelope, { publicKey: keys.publicKey });
    expect(result.valid).toBe(false);
  });

  it('rejects envelopes missing required fields', async () => {
    expect((await verifySubscriptionSignature(null)).valid).toBe(false);
    expect((await verifySubscriptionSignature({})).valid).toBe(false);
    expect((await verifySubscriptionSignature({ payload: makePayload() })).valid).toBe(false);
    expect((await verifySubscriptionSignature({ signature: 'x', payload: null })).valid).toBe(
      false
    );
  });
});
