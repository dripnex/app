import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  GITHUB_CONNECT_BUTTON,
  GITHUB_DISCONNECT_BUTTON,
  githubBadgeText,
  githubConnectUiState,
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
});
