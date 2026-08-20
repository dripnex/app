import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderMagicLinkEmail, renderWelcomeEmail } from '../src/emails/render.js';
import { createEmailService } from '../src/services/email.js';

const LINK = 'https://dripnex-marketing.pages.dev/auth/verify?token=abc&client=desktop';

describe('email templates', () => {
  it('renders a structured magic-link document with the verify URL', async () => {
    const { html, text } = await renderMagicLinkEmail(LINK);

    expect(html.toLowerCase()).toContain('<html');
    expect(html).toContain('dripnex-marketing.pages.dev/auth/verify?token=abc');
    expect(html).toContain('&amp;client=desktop');
    expect(html).toContain('Sign in');
    expect(html).not.toContain('#2563eb');
    expect(text).toContain(LINK);
    expect(text).toContain('15 minutes');
  });

  it('renders welcome mail with an unsubscribe URL', async () => {
    const { html, text } = await renderWelcomeEmail('you@example.com');
    const unsub = 'https://dripnex.app/newsletter/unsubscribe?email=you%40example.com';

    expect(html.toLowerCase()).toContain('<html');
    expect(html).toContain(unsub);
    expect(html).toContain('dripnex.app');
    expect(html).not.toContain('#2563eb');
    expect(text).toContain(unsub);
  });
});

describe('email service', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('does not send when the API key is missing', async () => {
    const service = createEmailService();
    await expect(service.sendMagicLink('a@b.co', LINK)).resolves.toBe(false);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('posts rendered HTML to Resend', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response('{}', { status: 200 }));

    const service = createEmailService('re_test');
    await expect(service.sendMagicLink('a@b.co', LINK)).resolves.toBe(true);

    expect(globalThis.fetch).toHaveBeenCalledOnce();
    const [, init] = vi.mocked(globalThis.fetch).mock.calls[0]!;
    expect(init?.method).toBe('POST');
    const body = JSON.parse(String(init?.body)) as { html: string; text: string; to: string[] };
    expect(body.to).toEqual(['a@b.co']);
    expect(body.html).toContain('dripnex-marketing.pages.dev/auth/verify?token=abc');
    expect(body.text).toContain(LINK);
  });
});
