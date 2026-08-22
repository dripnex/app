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
