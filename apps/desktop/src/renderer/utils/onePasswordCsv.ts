import { formatRecoveryKey } from './passphrase';

export interface OnePasswordItem {
  title: string;
  url: string;
  username: string;
  password: string;
  notes: string;
}

export interface OnePasswordExportFields {
  email?: string | null;
  passphrase?: string | null;
  recoveryKey?: string | null;
}

/** Header 1Password / Bitwarden / Apple Passwords map automatically. */
export const ONE_PASSWORD_CSV_HEADER = 'Title,Url,Username,Password,Notes';

export function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildOnePasswordItem(fields: OnePasswordExportFields): OnePasswordItem {
  const username = fields.email?.trim() || 'dripnex-sync';
  const password = fields.passphrase?.trim() || '';
  const recovery = fields.recoveryKey ? formatRecoveryKey(fields.recoveryKey) : '';
  const notes = [
    'Dripnex end-to-end encryption. This is not your sign-in — the app uses a magic link.',
    recovery ? `Recovery key: ${recovery}` : null,
    'Anyone with these secrets can decrypt your synced notes.',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    title: 'Dripnex sync passphrase',
    url: 'https://dripnex.app',
    username,
    password,
    notes,
  };
}

export function renderOnePasswordCsv(fields: OnePasswordExportFields): string {
  const item = buildOnePasswordItem(fields);
  const row = [item.title, item.url, item.username, item.password, item.notes]
    .map(csvEscape)
    .join(',');
  return `${ONE_PASSWORD_CSV_HEADER}\n${row}\n`;
}

export function downloadOnePasswordCsv(fields: OnePasswordExportFields): void {
  const csv = renderOnePasswordCsv(fields);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'Dripnex 1Password.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
