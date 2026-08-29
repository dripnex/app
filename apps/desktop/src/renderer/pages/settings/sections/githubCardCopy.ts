export function githubBadgeText(login: string | null): string {
  return login ? `Connected (@${login})` : 'Not connected';
}

export const GITHUB_WATCHERS_EMPTY = 'Watch a repo to pull issues into Inbox.';

export function githubImportedMessage(title: string): string {
  return `Imported “${title}” into Inbox.`;
}

export function githubWatchingMessage(label: string): string {
  return `Watching ${label}.`;
}

export function githubPulledMessage(pulled: {
  created: number;
  updated: number;
  skipped: number;
}): string {
  const bits = [`${pulled.created} new`, `${pulled.updated} updated`];
  if (pulled.skipped) bits.push(`${pulled.skipped} unchanged`);
  return `Pulled ${bits.join(', ')}.`;
}

export function githubPulledLabel(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return 'Not pulled yet';
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return 'Not pulled yet';
  const delta = Math.max(0, now - then);
  const mins = Math.floor(delta / 60_000);
  if (mins < 1) return 'Pulled just now';
  if (mins < 60) return `Pulled ${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Pulled ${hours}h ago`;
  return `Pulled ${Math.floor(hours / 24)}d ago`;
}

export const GITHUB_CONNECT_BUTTON = 'Connect';
export const GITHUB_DISCONNECT_BUTTON = 'Disconnect';

export function githubConnectUiState(
  result: { success: true; login: string } | { success: false; error: string }
): { ok: true; login: string; token: '' } | { ok: false; error: string } {
  if (result.success) return { ok: true, login: result.login, token: '' };
  return { ok: false, error: result.error };
}
