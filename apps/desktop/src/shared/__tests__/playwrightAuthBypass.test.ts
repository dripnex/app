import { describe, expect, it } from 'vitest';
import {
  PACKAGED_ARGV_FLAG,
  allowPlaywrightAuthBypass,
  isPackagedFromArgv,
} from '../playwrightAuthBypass';

describe('allowPlaywrightAuthBypass', () => {
  it('honors DRIPNEX_E2E only when unpackaged', () => {
    expect(allowPlaywrightAuthBypass('1', false)).toBe(true);
    expect(allowPlaywrightAuthBypass(undefined, false)).toBe(false);
    expect(allowPlaywrightAuthBypass('', false)).toBe(false);
  });

  it('never skips AuthGate in a packaged build', () => {
    expect(allowPlaywrightAuthBypass('1', true)).toBe(false);
    expect(allowPlaywrightAuthBypass(undefined, true)).toBe(false);
  });
});

describe('isPackagedFromArgv', () => {
  it('reads the main-process packaged flag', () => {
    expect(isPackagedFromArgv(['electron', PACKAGED_ARGV_FLAG])).toBe(true);
    expect(isPackagedFromArgv(['electron', '--dripnex-packaged=0'])).toBe(false);
  });
});
