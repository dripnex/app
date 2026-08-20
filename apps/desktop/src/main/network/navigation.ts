import { join, relative, isAbsolute } from 'path';
import { fileURLToPath } from 'url';
import { app, shell } from 'electron';
import { rendererAllowedOrigins } from '../devRenderer.js';
import { deliverDripnexUrl } from '../windows/authDeepLink.js';

export function isInternalNavigation(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (rendererAllowedOrigins().has(parsed.origin)) return true;

  if (parsed.protocol === 'file:') {
    let target: string;
    try {
      target = fileURLToPath(parsed);
    } catch {
      return false;
    }
    const appDir = join(__dirname, '../..');
    const rel = relative(appDir, target);
    return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
  }

  return false;
}

export function isSafeExternalUrl(url: string): boolean {
  return url.startsWith('https://') || url.startsWith('http://') || url.startsWith('mailto:');
}

/** Deny in-app navigation; only vetted http(s)/mailto go to the OS browser. */
export function registerNavigationGuards(): void {
  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('dripnex://')) {
        deliverDripnexUrl(url);
        return { action: 'deny' };
      }
      if (isSafeExternalUrl(url)) void shell.openExternal(url);
      return { action: 'deny' };
    });

    contents.on('will-navigate', (event, url) => {
      if (url.startsWith('dripnex://')) {
        event.preventDefault();
        deliverDripnexUrl(url);
        return;
      }
      if (isInternalNavigation(url)) return;
      event.preventDefault();
      if (isSafeExternalUrl(url)) void shell.openExternal(url);
    });
  });
}
