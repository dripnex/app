import { app, net } from 'electron';
import { z } from 'zod';
import { defineIpcHandler } from '../ipc/registry.js';
import { isBlockedFetchHost } from '../network/ssrf.js';
import { titleFromHtml } from './htmlTitle.js';

export async function fetchUrlTitle(url: string): Promise<{ title: string | null }> {
  try {
    if (url.length > 2048) return { title: null };
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { title: null };
    }
    if (isBlockedFetchHost(parsed.hostname)) {
      return { title: null };
    }
    const response = await net.fetch(url, {
      signal: AbortSignal.timeout(3000),
      headers: { 'User-Agent': 'Dripnex/' + app.getVersion() },
    });
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      return { title: null };
    }
    const reader = response.body?.getReader();
    if (!reader) return { title: null };
    let html = '';
    const decoder = new TextDecoder();
    while (html.length < 16384) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      if (/<\/title>/i.test(html)) break;
    }
    reader.cancel().catch(() => {});
    return { title: titleFromHtml(html) };
  } catch {
    return { title: null };
  }
}

export function registerEditorHandlers(): void {
  defineIpcHandler({
    channel: 'editor:fetchUrlTitle',
    args: z.tuple([z.string().min(1).max(2048)]),
    handler: fetchUrlTitle,
  });
}
