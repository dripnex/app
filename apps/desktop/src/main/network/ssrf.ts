/** Is this IPv4 (as 4 octet numbers) loopback/private/link-local/unspecified? */
function isBlockedIPv4(o: number[]): boolean {
  if (o.length !== 4 || o.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const a = o[0]!;
  const b = o[1]!;
  if (a === 127) return true;
  if (a === 10) return true;
  if (a === 0) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

/**
 * SSRF guard for `editor:fetchUrlTitle`. Blocks loopback, private, and
 * link-local literals. Does not resolve DNS (rebinding is a follow-up).
 */
export function isBlockedFetchHost(hostname: string): boolean {
  const h = hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');
  if (h === '' || h === 'localhost' || h.endsWith('.localhost')) return true;

  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (v4) return isBlockedIPv4([+v4[1]!, +v4[2]!, +v4[3]!, +v4[4]!]);

  if (h.includes(':')) {
    if (h === '::1' || h === '::') return true;
    const mapDotted = /(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
    if (mapDotted) {
      return isBlockedIPv4([+mapDotted[1]!, +mapDotted[2]!, +mapDotted[3]!, +mapDotted[4]!]);
    }
    const mapHex = /::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(h);
    if (mapHex) {
      const hi = parseInt(mapHex[1]!, 16);
      const lo = parseInt(mapHex[2]!, 16);
      return isBlockedIPv4([hi >> 8, hi & 0xff, lo >> 8, lo & 0xff]);
    }
    if (/^fe[89ab]/.test(h)) return true;
    if (/^f[cd]/.test(h)) return true;
    return false;
  }

  return false;
}
