import { describe, expect, it } from 'vitest';
import { resolveLocalHttpConfig } from '../http';

describe('resolveLocalHttpConfig', () => {
  it('returns null when neither env var is set', () => {
    expect(resolveLocalHttpConfig({})).toBeNull();
  });

  it('requires a token when the URL is set', () => {
    expect(() =>
      resolveLocalHttpConfig({ DRIPNEX_LOCAL_SERVER_URL: 'http://127.0.0.1:29168' })
    ).toThrow(/DRIPNEX_LOCAL_TOKEN is missing/);
  });

  it('requires a URL when the token is set', () => {
    expect(() => resolveLocalHttpConfig({ DRIPNEX_LOCAL_TOKEN: 'placeholder-token' })).toThrow(
      /DRIPNEX_LOCAL_SERVER_URL is missing/
    );
  });

  it('accepts loopback http and strips a trailing slash', () => {
    expect(
      resolveLocalHttpConfig({
        DRIPNEX_LOCAL_SERVER_URL: 'http://127.0.0.1:29168/',
        DRIPNEX_LOCAL_TOKEN: 'placeholder-token',
      })
    ).toEqual({
      baseUrl: 'http://127.0.0.1:29168',
      token: 'placeholder-token',
    });
  });

  it('strips trailing slashes in linear time (CodeQL js/polynomial-redos)', () => {
    // A `/+$` regex backtracks quadratically on a long run of slashes that is
    // not at the end of the string. 40k slashes took ~1.3s before this was
    // rewritten as a scan; the budget below fails loudly if it comes back.
    const pathological = `http://127.0.0.1:29168${'/'.repeat(40_000)}a`;
    const started = performance.now();

    const config = resolveLocalHttpConfig({
      DRIPNEX_LOCAL_SERVER_URL: pathological,
      DRIPNEX_LOCAL_TOKEN: 'placeholder-token',
    });

    expect(performance.now() - started).toBeLessThan(100);
    expect(config?.baseUrl).toBe(pathological);
  });

  it('strips every trailing slash, not just the last', () => {
    expect(
      resolveLocalHttpConfig({
        DRIPNEX_LOCAL_SERVER_URL: 'http://127.0.0.1:29168///',
        DRIPNEX_LOCAL_TOKEN: 'placeholder-token',
      })?.baseUrl
    ).toBe('http://127.0.0.1:29168');
  });

  it('accepts localhost', () => {
    expect(
      resolveLocalHttpConfig({
        DRIPNEX_LOCAL_SERVER_URL: 'http://localhost:29168',
        DRIPNEX_LOCAL_TOKEN: 'placeholder-token',
      })?.baseUrl
    ).toBe('http://localhost:29168');
  });

  it('rejects a non-loopback host', () => {
    expect(() =>
      resolveLocalHttpConfig({
        DRIPNEX_LOCAL_SERVER_URL: 'http://example.com:29168',
        DRIPNEX_LOCAL_TOKEN: 'placeholder-token',
      })
    ).toThrow(/this machine/);
  });

  it('rejects an invalid URL', () => {
    expect(() =>
      resolveLocalHttpConfig({
        DRIPNEX_LOCAL_SERVER_URL: 'not-a-url',
        DRIPNEX_LOCAL_TOKEN: 'placeholder-token',
      })
    ).toThrow(/not a valid URL/);
  });
});
