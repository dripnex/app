import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { createChildLogger } from '../../logger.js';

const execFileAsync = promisify(execFile);

function serviceLog() {
  try {
    return createChildLogger({ service: 'onepassword' });
  } catch {
    return null;
  }
}

const INTEGRATION_NAME = 'Dripnex Desktop';
const ITEM_TITLE = 'Dripnex sync passphrase';
const SITE_URL = 'https://dripnex.app';
const ACCOUNT_FILE = 'onepassword-account.json';

export interface OnePasswordVault {
  id: string;
  title: string;
}

export interface SaveLoginItemInput {
  account?: string | null;
  title: string;
  username: string;
  password: string;
  notes: string;
  websiteUrl: string;
  websiteLabel: string;
  appVersion: string;
}

export interface SaveToOnePasswordInput {
  account?: string | null;
  email?: string | null;
  passphrase: string;
  recoveryKey?: string | null;
  appVersion: string;
}

export type SaveToOnePasswordResult =
  | { success: true; vaultTitle: string; itemTitle: string }
  | { success: false; needsAccount: true; accounts: string[] }
  | { success: false; needsAccount?: false; error: string };

interface StoredAccount {
  account: string;
}

export function formatRecoveryKeyDashed(value: string): string {
  const hex = value.replace(/[^a-fA-F0-9]/g, '').toLowerCase();
  return hex.match(/.{1,4}/g)?.join('-') ?? hex;
}

export function pickPreferredVault(vaults: OnePasswordVault[]): OnePasswordVault | null {
  if (vaults.length === 0) return null;
  const preferred = vaults.find(vault => /^(personal|private|employee)$/i.test(vault.title.trim()));
  return preferred ?? vaults[0] ?? null;
}

export function mapOnePasswordError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();
  if (/cancel|denied|rejected|not authorized|authorization/.test(lower)) {
    return '1Password approval was cancelled.';
  }
  if (/not running|couldn.?t connect|connection refused|no such file|desktop app|unlock/.test(lower)) {
    return 'Open and unlock the 1Password app, then try again.';
  }
  if (/account/.test(lower) && /not found|unknown|invalid|no account/.test(lower)) {
    return 'That 1Password account was not found. Use the name at the top of the 1Password sidebar.';
  }
  if (/developer|integrat/.test(lower)) {
    return 'Enable SDK access in 1Password → Settings → Developer → Integrate with 1Password SDKs.';
  }
  return 'Could not save to 1Password. Unlock the app and approve the prompt.';
}

export async function discoverOpAccounts(): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync('op', ['account', 'list', '--format', 'json'], {
      timeout: 4000,
    });
    const parsed = JSON.parse(stdout) as Array<{
      account_uuid?: string;
      shorthand?: string;
    }>;
    if (!Array.isArray(parsed)) return [];
    const names = parsed
      .map(account => account.account_uuid || account.shorthand)
      .filter((value): value is string => typeof value === 'string' && value.length > 0);
    return [...new Set(names)];
  } catch {
    return [];
  }
}

function accountPath(dataDir: string): string {
  return join(dataDir, ACCOUNT_FILE);
}

export async function readStoredAccount(dataDir: string): Promise<string | null> {
  try {
    const raw = await fs.readFile(accountPath(dataDir), 'utf8');
    const parsed = JSON.parse(raw) as Partial<StoredAccount>;
    return typeof parsed.account === 'string' && parsed.account.trim() ? parsed.account.trim() : null;
  } catch {
    return null;
  }
}

export async function writeStoredAccount(dataDir: string, account: string): Promise<void> {
  await fs.writeFile(accountPath(dataDir), JSON.stringify({ account } satisfies StoredAccount), 'utf8');
}

async function collectVaults(listed: unknown): Promise<OnePasswordVault[]> {
  const vaults: OnePasswordVault[] = [];
  const push = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    const record = value as { id?: unknown; title?: unknown };
    if (typeof record.id !== 'string' || !record.id) return;
    vaults.push({
      id: record.id,
      title: typeof record.title === 'string' && record.title ? record.title : 'Vault',
    });
  };

  if (listed && typeof listed === 'object' && Symbol.asyncIterator in listed) {
    for await (const vault of listed as AsyncIterable<unknown>) {
      push(vault);
    }
    return vaults;
  }

  if (Array.isArray(listed)) {
    for (const vault of listed) push(vault);
  }
  return vaults;
}

export async function saveLoginItem(
  dataDir: string,
  input: SaveLoginItemInput
): Promise<SaveToOnePasswordResult> {
  const password = input.password.trim();
  if (!password) {
    return { success: false, error: 'Nothing to save.' };
  }

  const title = input.title.trim();
  if (!title) {
    return { success: false, error: 'Item title is required.' };
  }

  const discovered = await discoverOpAccounts();
  const account =
    input.account?.trim() || (await readStoredAccount(dataDir)) || (discovered.length === 1 ? discovered[0] : null);

  if (!account) {
    return { success: false, needsAccount: true, accounts: discovered };
  }

  try {
    const sdk = await import('@1password/sdk');
    const client = await sdk.createClient({
      auth: new sdk.DesktopAuth(account),
      integrationName: INTEGRATION_NAME,
      integrationVersion: input.appVersion.startsWith('v') ? input.appVersion : `v${input.appVersion}`,
    });

    const listed = await client.vaults.list({ decryptDetails: true });
    const vaults = await collectVaults(listed);
    const vault = pickPreferredVault(vaults);
    if (!vault) {
      return { success: false, error: 'No writable 1Password vault was found.' };
    }

    await client.items.create({
      title,
      category: sdk.ItemCategory.Login,
      vaultId: vault.id,
      notes: input.notes,
      fields: [
        {
          id: 'username',
          title: 'username',
          fieldType: sdk.ItemFieldType.Text,
          value: input.username,
        },
        {
          id: 'password',
          title: 'password',
          fieldType: sdk.ItemFieldType.Concealed,
          value: password,
        },
      ],
      websites: [
        {
          url: input.websiteUrl,
          label: input.websiteLabel,
          autofillBehavior: sdk.AutofillBehavior.AnywhereOnWebsite,
        },
      ],
    });

    await writeStoredAccount(dataDir, account);
    serviceLog()?.info({ vault: vault.title, item: title }, 'Saved item to 1Password');
    return { success: true, vaultTitle: vault.title, itemTitle: title };
  } catch (error) {
    serviceLog()?.warn(
      { error: error instanceof Error ? error.message : 'unknown' },
      '1Password save failed'
    );
    return { success: false, error: mapOnePasswordError(error) };
  }
}

export async function saveToOnePassword(
  dataDir: string,
  input: SaveToOnePasswordInput
): Promise<SaveToOnePasswordResult> {
  const passphrase = input.passphrase.trim();
  if (!passphrase) {
    return { success: false, error: 'Passphrase is empty.' };
  }

  const recovery = input.recoveryKey ? formatRecoveryKeyDashed(input.recoveryKey) : '';
  const notes = [
    'Dripnex end-to-end encryption. This is not your sign-in — the app uses a magic link.',
    recovery ? `Recovery key: ${recovery}` : null,
    'Anyone with these secrets can decrypt your synced notes.',
  ]
    .filter(Boolean)
    .join('\n');

  return saveLoginItem(dataDir, {
    account: input.account,
    title: ITEM_TITLE,
    username: input.email?.trim() || 'dripnex-sync',
    password: passphrase,
    notes,
    websiteUrl: SITE_URL,
    websiteLabel: 'dripnex.app',
    appVersion: input.appVersion,
  });
}
