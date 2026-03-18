// apps/desktop/src/main/ai/ipc-ai.ts
import { ipcMain, app, dialog } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import type { AIService, ChatHandle } from '@readied/ai-core';

const BATCH_INTERVAL_MS = 50;

// Per-window active handle tracking
const activeHandles = new Map<number, Map<string, ChatHandle>>();

export function registerAIHandlers(service: AIService): void {
  // ─── Streaming chat ─────────────────────────────────────
  ipcMain.handle(
    'ai:chat',
    (
      event,
      request: {
        query: string;
        currentNote?: { id: string; title: string; content: string } | null;
        relevantNotes: Array<{ id: string; title: string; content: string }>;
        history: Array<{ role: 'user' | 'assistant'; content: string }>;
        mode: 'chat' | 'ask-notes';
        provider: string;
        model: string;
        providerConfig: { apiKey?: string; baseUrl?: string };
        maxResponseTokens?: number;
      }
    ) => {
      const windowId = event.sender.id;

      const handle = service.chat(request);

      // Track handle
      if (!activeHandles.has(windowId)) {
        activeHandles.set(windowId, new Map());
      }
      activeHandles.get(windowId)!.set(handle.requestId, handle);

      // Start consuming stream with batching
      consumeStream(event.sender, handle);

      return { requestId: handle.requestId };
    }
  );

  // ─── Cancel ─────────────────────────────────────────────
  ipcMain.handle('ai:cancel', (_event, requestId: string) => {
    for (const handles of activeHandles.values()) {
      const handle = handles.get(requestId);
      if (handle) {
        handle.abort();
        handles.delete(requestId);
        return;
      }
    }
  });

  // ─── Validate (for settings test-connection) ────────────
  ipcMain.handle(
    'ai:validate',
    async (_event, config: { provider: string; apiKey?: string; baseUrl?: string }) => {
      // Access provider directly from registry via service
      // For now, simple validation using a no-op chat
      try {
        const handle = service.chat({
          query: 'test',
          history: [],
          relevantNotes: [],
          mode: 'chat',
          provider: config.provider ?? 'anthropic',
          model: 'claude-sonnet-4-20250514',
          providerConfig: { apiKey: config.apiKey, baseUrl: config.baseUrl },
          maxResponseTokens: 1,
        });
        // Immediately abort — we just want to verify the connection
        handle.abort();
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
  );

  // ─── Export/Import presets (kept from old impl) ─────────
  ipcMain.handle('ai:exportPreset', async (_event, presetJson: string) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export AI Command Preset',
      defaultPath: 'ai-commands.json',
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
    });
    if (canceled || !filePath) return { ok: false, error: 'Export cancelled' };
    try {
      await writeFile(filePath, presetJson, 'utf-8');
      return { ok: true, filePath };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('ai:importPreset', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Import AI Command Preset',
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (canceled || filePaths.length === 0) return { ok: false, error: 'Import cancelled' };
    try {
      const content = await readFile(filePaths[0]!, 'utf-8');
      return { ok: true, content };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // ─── Cleanup on window destroy ──────────────────────────
  app.on('browser-window-created', (_event, window) => {
    window.webContents.on('destroyed', () => {
      const handles = activeHandles.get(window.webContents.id);
      if (handles) {
        for (const handle of handles.values()) handle.abort();
        activeHandles.delete(window.webContents.id);
      }
    });
  });
}

// ─── Stream consumer with batching ────────────────────────

async function consumeStream(sender: Electron.WebContents, handle: ChatHandle): Promise<void> {
  let textBuffer = '';
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  const flush = (): void => {
    if (textBuffer && !sender.isDestroyed()) {
      sender.send('ai:event', handle.requestId, { type: 'text', delta: textBuffer });
      textBuffer = '';
    }
    flushTimer = null;
  };

  try {
    for await (const event of handle.events) {
      if (sender.isDestroyed()) {
        handle.abort();
        break;
      }

      if (event.type === 'text') {
        textBuffer += event.delta;
        if (!flushTimer) {
          flushTimer = setTimeout(flush, BATCH_INTERVAL_MS);
        }
      } else {
        // Non-text events: flush buffer first, then send immediately
        if (flushTimer) {
          clearTimeout(flushTimer);
          flushTimer = null;
        }
        flush();
        sender.send('ai:event', handle.requestId, event);
      }
    }

    // Final flush
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    flush();
  } catch (err) {
    flush();
    if (!sender.isDestroyed()) {
      sender.send('ai:event', handle.requestId, {
        type: 'error',
        code: 'provider_error',
        error: err instanceof Error ? err.message : String(err),
        retryable: false,
      });
    }
  } finally {
    // Remove from active handles
    for (const handles of activeHandles.values()) {
      handles.delete(handle.requestId);
    }
  }
}
