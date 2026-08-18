import { request as httpRequest } from 'node:http';
import type { BrowserWindow } from 'electron';
import { getLogger } from './logger.js';

/** localhost and 127.0.0.1 are the same Vite server — treat both as in-app. */
export function rendererAllowedOrigins(): Set<string> {
  const raw = process.env.ELECTRON_RENDERER_URL;
  const origins = new Set<string>();
  if (!raw) return origins;
  try {
    const url = new URL(raw);
    origins.add(url.origin);
    if (url.hostname === 'localhost') {
      url.hostname = '127.0.0.1';
      origins.add(url.origin);
    } else if (url.hostname === '127.0.0.1') {
      url.hostname = 'localhost';
      origins.add(url.origin);
    }
  } catch {
    // ignore malformed ELECTRON_RENDERER_URL
  }
  return origins;
}

export function rendererDevBase(): string | undefined {
  const raw = process.env.ELECTRON_RENDERER_URL;
  if (!raw) return undefined;
  return raw.replace('://localhost', '://127.0.0.1').replace(/\/$/, '');
}

function waitForHttp(url: string, timeoutMs: number): Promise<void> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = httpRequest(url, { method: 'GET', timeout: 800 }, response => {
        response.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`Renderer not reachable at ${url}`));
          return;
        }
        setTimeout(attempt, 150);
      });
      req.on('timeout', () => {
        req.destroy();
      });
      req.end();
    };
    attempt();
  });
}

export async function loadDevRenderer(win: BrowserWindow, url: string): Promise<void> {
  try {
    await waitForHttp(url, 20_000);
  } catch (error) {
    getLogger().error(
      { url, error: error instanceof Error ? error.message : String(error) },
      'Renderer URL not reachable'
    );
  }
  if (win.isDestroyed()) return;

  let attempts = 0;
  const tryLoad = async () => {
    if (win.isDestroyed()) return;
    attempts += 1;
    try {
      await win.loadURL(url);
    } catch (error) {
      getLogger().error(
        { url, attempts, error: error instanceof Error ? error.message : String(error) },
        'loadURL threw'
      );
    }
  };

  win.webContents.on('did-fail-load', (_event, code, desc, failedUrl, isMainFrame) => {
    if (!isMainFrame || win.isDestroyed()) return;
    if (failedUrl.startsWith('chrome-error:')) return;
    getLogger().error({ code, desc, failedUrl, attempts }, 'Renderer failed to load');
    if (attempts >= 10) return;
    void waitForHttp(url, 8_000)
      .catch(() => undefined)
      .then(() => {
        if (!win.isDestroyed()) return win.loadURL(url);
      });
  });

  win.webContents.on('did-finish-load', () => {
    if (win.isDestroyed()) return;
    const current = win.webContents.getURL();
    if (current.startsWith('chrome-error:')) return;
    if (!win.isVisible()) win.show();
  });

  await tryLoad();
}
