import { describe, expect, it } from 'vitest';
import { renderEmergencyKitHtml } from '../emergencyKit';

describe('emergencyKit', () => {
  it('includes account, passphrase and recovery key', () => {
    const html = renderEmergencyKitHtml({
      email: 'you@example.com',
      passphrase: 'coral maple otter ridge linen quartz',
      recoveryKey: 'aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899',
      createdAt: new Date('2026-08-17T00:00:00Z'),
    });
    expect(html).toContain('Emergency Kit');
    expect(html).toContain('you@example.com');
    expect(html).toContain('coral maple otter ridge linen quartz');
    expect(html).toContain('aabb-ccdd');
    expect(html).not.toContain('<script');
  });

  it('escapes html in secrets', () => {
    const html = renderEmergencyKitHtml({
      passphrase: '<script>alert(1)</script>',
    });
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>alert');
  });
});
