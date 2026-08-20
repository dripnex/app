import { parseDripnexUrl } from '../../shared/parseDripnexUrl';

export { parseDripnexUrl, type DripnexDeepLink } from '../../shared/parseDripnexUrl';

export function emitLocalDeepLink(href: string): boolean {
  const parsed = parseDripnexUrl(href);
  if (!parsed) return false;
  window.dispatchEvent(new CustomEvent('dripnex:open', { detail: parsed }));
  return true;
}
