import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ONE_PASSWORD_NEED_ACCOUNT,
  ONE_PASSWORD_UNREACHABLE,
  onePasswordSavedStatus,
  onePasswordSavedToast,
} from '../onePasswordCopy';

const here = dirname(fileURLToPath(import.meta.url));
const saveBtn = readFileSync(
  join(here, '../../components/sync/SaveToOnePasswordButton.tsx'),
  'utf8'
);
const providerKey = readFileSync(join(here, '../../pages/settings/ai/SaveProviderKey.tsx'), 'utf8');

describe('onePasswordCopy', () => {
  it('says where it landed and what happens next', () => {
    expect(onePasswordSavedStatus('Personal')).toBe('Saved in Personal');
    expect(onePasswordSavedToast('Personal')).toBe(
      'Saved in Personal. Approve the next save with Touch ID.'
    );
    expect(ONE_PASSWORD_NEED_ACCOUNT).toMatch(/sidebar/);
    expect(ONE_PASSWORD_UNREACHABLE).toBe('Could not reach 1Password.');
  });

  it('toasts from passphrase save and provider-key save', () => {
    expect(saveBtn).toContain('toast.success(onePasswordSavedToast(result.vaultTitle))');
    expect(saveBtn).toContain('toast.error(message)');
    expect(providerKey).toContain('toast.success(onePasswordSavedToast(result.vaultTitle))');
    expect(providerKey).toContain('toast.error(message)');
  });
});
