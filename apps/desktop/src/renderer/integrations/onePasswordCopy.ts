/** Copy for 1Password save. Explain what happened and what happens next. */

export function onePasswordSavedStatus(vaultTitle: string): string {
  return `Saved in ${vaultTitle}`;
}

export function onePasswordSavedToast(vaultTitle: string): string {
  return `Saved in ${vaultTitle}. Approve the next save with Touch ID.`;
}

export const ONE_PASSWORD_NEED_ACCOUNT =
  'Enter the account name at the top of the 1Password sidebar.';

export const ONE_PASSWORD_UNREACHABLE = 'Could not reach 1Password.';

export const ONE_PASSWORD_WAITING = 'Waiting for 1Password…';
