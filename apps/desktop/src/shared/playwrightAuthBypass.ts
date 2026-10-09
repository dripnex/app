/**
 * Playwright may skip AuthGate only in unpackaged runs.
 * Packaged builds never honor DRIPNEX_E2E.
 */

export const PACKAGED_ARGV_FLAG = '--dripnex-packaged=1';

export function isPackagedFromArgv(argv: readonly string[]): boolean {
  return argv.includes(PACKAGED_ARGV_FLAG);
}

export function allowPlaywrightAuthBypass(
  dripnexE2E: string | undefined,
  isPackaged: boolean
): boolean {
  return !isPackaged && dripnexE2E === '1';
}
