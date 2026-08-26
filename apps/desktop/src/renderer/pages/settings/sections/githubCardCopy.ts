export function githubBadgeText(login: string | null): string {
  return login ? `Connected (@${login})` : 'Not connected';
}

export const GITHUB_CONNECT_BUTTON = 'Connect';
export const GITHUB_DISCONNECT_BUTTON = 'Disconnect';

export function githubConnectUiState(
  result: { success: true; login: string } | { success: false; error: string }
): { ok: true; login: string; token: '' } | { ok: false; error: string } {
  if (result.success) return { ok: true, login: result.login, token: '' };
  return { ok: false, error: result.error };
}
