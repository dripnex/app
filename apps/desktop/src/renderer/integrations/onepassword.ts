import type {
  OnePasswordSaveInput,
  OnePasswordSaveResult,
  OnePasswordSecretInput,
} from '../../preload/api/integrations';
import { INTEGRATION_UNAVAILABLE, getOnePasswordApi } from './host';

export type { OnePasswordSaveInput, OnePasswordSaveResult };

export async function discoverOnePassword(): Promise<{
  available: boolean;
  stored: string | null;
  accounts: string[];
}> {
  const api = getOnePasswordApi();
  if (!api) {
    return { available: false, stored: null, accounts: [] };
  }
  const result = await api.discover();
  return {
    available: true,
    stored: result.stored ?? null,
    accounts: result.accounts ?? [],
  };
}

export async function setOnePasswordAccount(
  account: string
): Promise<{ success: boolean; error?: string }> {
  const api = getOnePasswordApi();
  if (!api) {
    return { success: false, error: INTEGRATION_UNAVAILABLE };
  }
  await api.setAccount(account);
  return { success: true };
}

export async function saveToOnePassword(
  input: OnePasswordSaveInput
): Promise<OnePasswordSaveResult> {
  const api = getOnePasswordApi();
  if (!api) {
    return { success: false, error: INTEGRATION_UNAVAILABLE };
  }
  return api.save(input);
}

export async function saveSecretToOnePassword(
  input: OnePasswordSecretInput
): Promise<OnePasswordSaveResult> {
  const api = getOnePasswordApi();
  if (!api || typeof api.saveSecret !== 'function') {
    return { success: false, error: INTEGRATION_UNAVAILABLE };
  }
  return api.saveSecret(input);
}
