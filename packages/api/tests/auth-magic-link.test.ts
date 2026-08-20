/**
 * Tests for POST /auth/magic-link — magic link email generation
 *
 * Regression: webmail clients (Gmail, Outlook.com, etc.) strip anchor hrefs
 * whose URL scheme is not on their allowlist (http/https/mailto/...). A raw
 * `dripnex://` deep link renders as non-clickable text. The email must always
 * link to the https landing page, which performs the desktop handoff itself.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import app from '../src/index.js';
import { createTestEnv, initTestDb, cleanupTestDb } from './helpers.js';

describe('POST /auth/magic-link — email link is webmail-clickable', () => {
  const { env } = createTestEnv();
  // Email service only sends when an API key is present.
  const envWithResend = { ...env, RESEND_API_KEY: 'test-resend-key' };

  let capturedBody: { html?: string; text?: string } | null;

  beforeAll(async () => {
    await initTestDb(env);
  });

  afterAll(() => {
    cleanupTestDb(env);
  });

  beforeEach(() => {
    capturedBody = null;
    // Intercept the Resend API call and capture the email payload.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (typeof url === 'string' && url.includes('api.resend.com')) {
          capturedBody = JSON.parse(init!.body as string);
          return new Response(JSON.stringify({ id: 'test-email-id' }), { status: 200 });
        }
        throw new Error(`Unexpected fetch to ${url}`);
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function requestMagicLink(client: 'web' | 'desktop') {
    return app.request(
      '/auth/magic-link',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: `user-${client}@test.com`, client }),
      },
      envWithResend
    );
  }

  it('desktop client email uses an https link (not a dripnex:// deep link)', async () => {
    const res = await requestMagicLink('desktop');
    expect(res.status).toBe(200);
    expect(capturedBody).not.toBeNull();

    // The clickable button href must be https so Gmail/Outlook keep it clickable.
    expect(capturedBody!.html).toContain(
      'href="https://dripnex-marketing.pages.dev/auth/verify?token='
    );
    // A raw custom-scheme deep link would be stripped by webmail — must not appear.
    expect(capturedBody!.html).not.toContain('href="dripnex://');
    expect(capturedBody!.text).not.toContain('dripnex://');
  });

  it('web client email uses an https link', async () => {
    const res = await requestMagicLink('web');
    expect(res.status).toBe(200);
    expect(capturedBody!.html).toContain(
      'href="https://dripnex-marketing.pages.dev/auth/verify?token='
    );
    expect(capturedBody!.html).not.toContain('href="dripnex://');
  });
});
