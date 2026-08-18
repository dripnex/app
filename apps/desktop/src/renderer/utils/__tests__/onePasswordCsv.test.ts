import { describe, expect, it } from 'vitest';
import {
  ONE_PASSWORD_CSV_HEADER,
  buildOnePasswordItem,
  csvEscape,
  renderOnePasswordCsv,
} from '../onePasswordCsv';

describe('onePasswordCsv', () => {
  it('quotes commas and doubled quotes', () => {
    expect(csvEscape('plain')).toBe('plain');
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
  });

  it('builds a login 1Password can import', () => {
    const csv = renderOnePasswordCsv({
      email: 'you@example.com',
      passphrase: 'coral maple otter ridge linen quartz',
      recoveryKey: 'aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899',
    });
    expect(csv.startsWith(`${ONE_PASSWORD_CSV_HEADER}\n`)).toBe(true);
    expect(csv).toContain('Dripnex sync passphrase');
    expect(csv).toContain('https://dripnex.app');
    expect(csv).toContain('you@example.com');
    expect(csv).toContain('coral maple otter ridge linen quartz');
    expect(csv).toContain('aabb-ccdd');
  });

  it('falls back to a stable username when email is missing', () => {
    const item = buildOnePasswordItem({ passphrase: 'word word word word word word' });
    expect(item.username).toBe('dripnex-sync');
    expect(item.password).toBe('word word word word word word');
  });
});
