import { BrowserWindow } from 'electron';
import { getLogger } from '../logger.js';
import { parseDripnexUrl, type DripnexDeepLink } from './deepLink.js';

export { parseDripnexUrl } from './deepLink.js';
export type { DripnexDeepLink } from './deepLink.js';

let pending: DripnexDeepLink | null = null;

export function parseAuthVerifyToken(url: string): string | null {
  const parsed = parseDripnexUrl(url);
  return parsed?.kind === 'auth-verify' ? parsed.token : null;
}

export function queueAuthToken(token: string): void {
  pending = { kind: 'auth-verify', token };
}

export function queueDeepLink(link: DripnexDeepLink): void {
  pending = link;
}

export function takePendingAuthToken(): string | null {
  if (pending?.kind !== 'auth-verify') return null;
  const token = pending.token;
  pending = null;
  return token;
}

function targetWindow(): BrowserWindow | undefined {
  return BrowserWindow.getAllWindows().find(
    win =>
      !win.isDestroyed() && !win.webContents.isDestroyed() && win.webContents.isLoading() === false
  );
}

function sendDeepLink(win: BrowserWindow, link: DripnexDeepLink): void {
  if (link.kind === 'auth-verify') {
    win.webContents.send('auth:verify-token', link.token);
  }
  win.webContents.send('app:deep-link', link);
  win.show();
  win.focus();
}

export function deliverAuthToken(token: string): void {
  deliverDeepLink({ kind: 'auth-verify', token });
}

export function deliverDeepLink(link: DripnexDeepLink): void {
  const mainWin = targetWindow();
  if (mainWin && !mainWin.webContents.isDestroyed()) {
    sendDeepLink(mainWin, link);
    return;
  }
  queueDeepLink(link);
}

export function deliverDripnexUrl(url: string): boolean {
  const parsed = parseDripnexUrl(url);
  if (!parsed) return false;
  deliverDeepLink(parsed);
  return true;
}

export function flushPendingAuthToken(win: BrowserWindow): void {
  if (!pending) return;
  if (win.isDestroyed() || win.webContents.isDestroyed()) return;
  getLogger().info({ kind: pending.kind }, 'Delivering queued deep link to renderer');
  const link = pending;
  pending = null;
  sendDeepLink(win, link);
}
