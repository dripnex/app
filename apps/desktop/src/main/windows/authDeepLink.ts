import { BrowserWindow } from 'electron';
import { getLogger } from '../logger.js';

let pendingAuthToken: string | null = null;

export function parseAuthVerifyToken(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'auth' && parsed.pathname === '/verify') {
      return parsed.searchParams.get('token');
    }
  } catch {
    return null;
  }
  return null;
}

export function queueAuthToken(token: string): void {
  pendingAuthToken = token;
}

export function takePendingAuthToken(): string | null {
  const token = pendingAuthToken;
  pendingAuthToken = null;
  return token;
}

export function deliverAuthToken(token: string): void {
  const mainWin = BrowserWindow.getAllWindows().find(
    win =>
      !win.isDestroyed() && !win.webContents.isDestroyed() && win.webContents.isLoading() === false
  );
  if (mainWin && !mainWin.webContents.isDestroyed()) {
    mainWin.webContents.send('auth:verify-token', token);
    mainWin.show();
    mainWin.focus();
    return;
  }
  queueAuthToken(token);
}

export function flushPendingAuthToken(win: BrowserWindow): void {
  const token = takePendingAuthToken();
  if (!token) return;
  if (win.isDestroyed() || win.webContents.isDestroyed()) {
    queueAuthToken(token);
    return;
  }
  getLogger().info('Delivering queued auth token to renderer');
  win.webContents.send('auth:verify-token', token);
  win.show();
  win.focus();
}
