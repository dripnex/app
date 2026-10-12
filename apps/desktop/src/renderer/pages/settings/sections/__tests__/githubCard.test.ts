import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  GITHUB_CONNECT_BUTTON,
  GITHUB_DISCONNECT_BUTTON,
  GITHUB_WATCHERS_EMPTY,
  githubBadgeText,
  githubConnectUiState,
  githubImportedMessage,
  githubPulledLabel,
  githubPulledMessage,
  githubWatchingMessage,
} from '../githubCardCopy';

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../GitHubCard.tsx'),
  'utf8'
);

describe('GitHubCard Connect / Connected / Disconnect', () => {
  it('badges Not connected and Connected (login)', () => {
    expect(githubBadgeText(null)).toBe('Not connected');
    expect(githubBadgeText('tomas')).toBe('Connected (@tomas)');
    expect(src).toContain('githubBadgeText(login)');
  });

  it('keeps Connect and Disconnect in the card chrome', () => {
    expect(GITHUB_CONNECT_BUTTON).toBe('Connect');
    expect(GITHUB_DISCONNECT_BUTTON).toBe('Disconnect');
    expect(src).toContain('{GITHUB_CONNECT_BUTTON}');
    expect(src).toContain('{GITHUB_DISCONNECT_BUTTON}');
    expect(src).toContain('void connect()');
    expect(src).toContain('void disconnect()');
  });

  it('clears the token from renderer state after a successful connect', () => {
    const next = githubConnectUiState({ success: true, login: 'tomas' });
    expect(next).toEqual({ ok: true, login: 'tomas', token: '' });
    expect(next.ok && next.token).toBe('');
    expect(src).toContain('githubConnectUiState');
    expect(src).toContain('setToken(next.token)');
  });

  it('does not read a token back from status()', () => {
    expect(src).toContain('status.connected ? status.login');
    expect(src).not.toMatch(/status\.(token|secret|apiKey)/);
  });

  it('formats last-pulled time and import copy', () => {
    expect(githubPulledLabel(null)).toBe('Not pulled yet');
    expect(githubPulledLabel('not-a-date')).toBe('Not pulled yet');
    const now = Date.parse('2026-08-28T12:00:00Z');
    expect(githubPulledLabel('2026-08-28T11:59:30Z', now)).toBe('Pulled just now');
    expect(githubPulledLabel('2026-08-28T11:40:00Z', now)).toBe('Pulled 20m ago');
    expect(githubImportedMessage('Fix login')).toBe('Imported “Fix login” into Inbox.');
    expect(GITHUB_WATCHERS_EMPTY).toMatch(/Watch a repo/);
    expect(src).toContain('githubPulledLabel');
    expect(src).toContain('GITHUB_WATCHERS_EMPTY');
  });

  it('toasts watch and pull, and submits Watch on Enter', () => {
    expect(githubWatchingMessage('acme/app')).toBe('Watching acme/app.');
    expect(githubPulledMessage({ created: 2, updated: 1, skipped: 3 })).toBe(
      'Pulled 2 new, 1 updated, 3 unchanged.'
    );
    expect(src).toContain('githubWatchingMessage');
    expect(src).toContain('githubPulledMessage');
    expect(src).toContain('toast.success(watching)');
    expect(src).toContain('toast.success(pulledCopy)');
    expect(src).toContain("event.key === 'Enter' && watchSpec.trim()");
  });
});
