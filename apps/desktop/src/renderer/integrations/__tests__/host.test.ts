import { describe, expect, it } from 'vitest';
import { INTEGRATION_UNAVAILABLE, getOnePasswordApi } from '../host';
import { discoverOnePassword, saveSecretToOnePassword, saveToOnePassword } from '../onepassword';

describe('integrations host', () => {
  it('returns null when preload has no 1Password bridge', () => {
    expect(getOnePasswordApi()).toBeNull();
  });

  it('save degrades instead of throwing', async () => {
    const result = await saveToOnePassword({ passphrase: 'coral maple otter ridge linen quartz' });
    expect(result).toEqual({ success: false, error: INTEGRATION_UNAVAILABLE });
  });

  it('saveSecret degrades instead of throwing', async () => {
    const result = await saveSecretToOnePassword({
      title: 'Dripnex · Anthropic',
      username: 'anthropic',
      password: 'sk-ant-test',
      websiteUrl: 'https://console.anthropic.com/settings/keys',
      websiteLabel: 'Anthropic',
    });
    expect(result).toEqual({ success: false, error: INTEGRATION_UNAVAILABLE });
  });

  it('discover degrades instead of throwing', async () => {
    await expect(discoverOnePassword()).resolves.toEqual({
      available: false,
      stored: null,
      accounts: [],
    });
  });
});
