export type SyncFooterStatus =
  | 'idle'
  | 'syncing'
  | 'error'
  | 'offline'
  | 'auth-expired'
  | 'needs-setup';

export type SyncFooterAction = 'setup' | 'retry';

export interface SyncFooterInput {
  encryptionReady: boolean | null;
  status: SyncFooterStatus;
  error: string | null;
  consecutiveFailures: number;
}

export interface SyncFooterCopy {
  label: string;
  action: SyncFooterAction | null;
}

export function looksLikeMissingCek(error: string | null): boolean {
  return /encryption|passphrase|cek/i.test(error ?? '');
}

/** Footer never offers Retry unless a CEK is loaded. */
export function syncFooterAction(input: SyncFooterInput): SyncFooterAction | null {
  if (input.encryptionReady === true) {
    if (input.status === 'error' || input.consecutiveFailures >= 2) return 'retry';
    return null;
  }
  if (input.encryptionReady === false) return 'setup';
  if (input.status === 'needs-setup' || looksLikeMissingCek(input.error)) return 'setup';
  return null;
}

export function syncFooterErrorLabel(input: SyncFooterInput): string {
  if (syncFooterAction(input) === 'setup') return 'Set up encryption';
  if (input.status === 'auth-expired') return 'Session expired';
  return input.error ?? 'Sync error';
}
