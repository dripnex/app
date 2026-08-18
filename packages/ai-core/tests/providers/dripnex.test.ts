import { describe, expect, it, vi } from 'vitest';
import { DripnexProvider } from '../../src/providers/dripnex';
import type { FetchFn } from '../../src/provider';

describe('DripnexProvider', () => {
  it('refuses to chat without a product key', async () => {
    const fetchFn: FetchFn = vi.fn();
    const provider = new DripnexProvider(fetchFn);
    const events = [];
    for await (const event of provider.chat(
      {
        model: 'claude-sonnet-5',
        system: '',
        messages: [{ role: 'user', content: 'hi' }],
        maxTokens: 16,
      },
      {}
    )) {
      events.push(event);
    }
    expect(fetchFn).not.toHaveBeenCalled();
    expect(events[0]).toMatchObject({ type: 'error', code: 'auth_failed' });
  });

  it('validate fails when this install has no product key', async () => {
    const provider = new DripnexProvider(vi.fn());
    const result = await provider.validate({});
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/hosted Claude/i);
  });
});
