// apps/desktop/src/main/ai/ipc-ai.ts
import { readFile, writeFile } from 'node:fs/promises';
import { ipcMain, app, dialog } from 'electron';
import { z } from 'zod';
import type { AIService, ChatHandle, ToolChatHandle, ToolCall } from '@readied/ai-core';
import type { ToolRegistry } from '@readied/ai-core';

const BATCH_INTERVAL_MS = 50;

// ─── Input validation ───────────────────────────────────
// These channels stream (they need event.sender) so they can't use the
// tuple-based defineIpcHandler, but renderer input is still untrusted and
// must be bounded. Parse before touching business logic.

const MAX_CONTENT = 1024 * 1024; // 1 MB per field
const IdStrSchema = z.string().min(1).max(256);
const NoteContextSchema = z.object({
  id: z.string().max(256),
  title: z.string().max(4096),
  content: z.string().max(MAX_CONTENT),
});
const ChatRequestSchema = z.object({
  query: z.string().max(MAX_CONTENT),
  currentNote: NoteContextSchema.nullish(),
  relevantNotes: z.array(NoteContextSchema).max(200).default([]),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(MAX_CONTENT),
      })
    )
    .max(1000)
    .default([]),
  mode: z.enum(['chat', 'ask-notes']),
  provider: z.string().min(1).max(64),
  model: z.string().min(1).max(256),
  providerConfig: z
    .object({
      apiKey: z.string().max(4096).optional(),
      baseUrl: z.string().max(2048).optional(),
    })
    .default({}),
  maxResponseTokens: z.number().int().positive().max(200_000).optional(),
  tools: z.boolean().optional(),
});
const ValidateConfigSchema = z.object({
  provider: z.string().min(1).max(64),
  apiKey: z.string().max(4096).optional(),
  baseUrl: z.string().max(2048).optional(),
});
const RendererToolResultSchema = z.object({
  ok: z.boolean(),
  content: z.string().max(MAX_CONTENT),
  error: z.string().max(4096).optional(),
});

// Per-window active handle tracking
const activeHandles = new Map<number, Map<string, ChatHandle | ToolChatHandle>>();

// Pending tool confirmations: requestId -> callId -> resolve function
const pendingConfirmations = new Map<string, Map<string, (approved: boolean) => void>>();
const CONFIRM_TIMEOUT_MS = 60_000;

// Pending renderer tool results: callId -> resolve function
const pendingRendererResults = new Map<
  string,
  (result: { ok: boolean; content: string; error?: string }) => void
>();
const RENDERER_TOOL_TIMEOUT_MS = 30_000;

export function registerAIHandlers(service: AIService, toolRegistry: ToolRegistry): void {
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
        tools?: boolean;
      }
    ) => {
      const parsed = ChatRequestSchema.safeParse(request);
      if (!parsed.success) {
        throw new Error(`Invalid ai:chat request: ${parsed.error.message}`);
      }
      request = parsed.data as typeof request;

      const windowId = event.sender.id;
      const toolDefs = request.tools ? toolRegistry.getDefinitions() : [];

      // Build executeTool callback that closes over requestId (set after handle creation)
      let requestId = '';
      const executeTool = async (call: ToolCall) => {
        const tool = toolRegistry.get(call.name);
        if (!tool) {
          return {
            ok: false,
            content: `Unknown tool: ${call.name}`,
            error: `Unknown tool: ${call.name}`,
          };
        }

        if (tool.requiresConfirmation) {
          event.sender.send('ai:event', requestId, {
            type: 'tool_confirm_needed',
            callId: call.id,
          });
          const approved = await waitForConfirmation(requestId, call.id);
          if (!approved) {
            return { ok: false, content: 'Tool execution cancelled by user', error: 'Cancelled' };
          }
        }

        // Renderer-only tools delegate execution to the renderer process via IPC
        if (tool.rendererOnly) {
          return executeToolInRenderer(event.sender, requestId, call.id, call.name, call.args);
        }

        return tool.execute(call.args);
      };

      const handle =
        toolDefs.length > 0
          ? service.chatWithTools({ ...request, tools: toolDefs, executeTool })
          : service.chat(request);

      requestId = handle.requestId;

      // Track handle
      if (!activeHandles.has(windowId)) {
        activeHandles.set(windowId, new Map());
      }
      activeHandles.get(windowId)!.set(handle.requestId, handle);

      void consumeStream(event.sender, handle);

      return { requestId: handle.requestId };
    }
  );

  // ─── Cancel ─────────────────────────────────────────────
  ipcMain.handle('ai:cancel', (event, requestId: string) => {
    if (!IdStrSchema.safeParse(requestId).success) return;
    const windowId = event.sender.id;
    const handles = activeHandles.get(windowId);
    const handle = handles?.get(requestId);
    if (handle) {
      handle.abort();
      handles!.delete(requestId);
    }
  });

  // ─── Validate (for settings test-connection) ────────────
  ipcMain.handle(
    'ai:validate',
    async (_event, config: { provider: string; apiKey?: string; baseUrl?: string }) => {
      const parsedConfig = ValidateConfigSchema.safeParse(config);
      if (!parsedConfig.success) {
        return { ok: false, error: `Invalid ai:validate config: ${parsedConfig.error.message}` };
      }
      config = parsedConfig.data;
      try {
        const handle = service.chat({
          query: 'Say "ok".',
          history: [],
          relevantNotes: [],
          mode: 'chat',
          provider: config.provider ?? 'anthropic',
          model: 'claude-sonnet-4-20250514',
          providerConfig: { apiKey: config.apiKey, baseUrl: config.baseUrl },
          maxResponseTokens: 1,
        });
        // Consume stream to actually trigger the provider call
        for await (const event of handle.events) {
          if (event.type === 'error') {
            handle.abort();
            return { ok: false, error: `${event.code}: ${event.error}` };
          }
          // Got any successful event — provider is reachable
          if (event.type === 'text' || event.type === 'done') {
            handle.abort();
            return { ok: true };
          }
        }
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

  // ─── Tool confirmation ──────────────────────────────────
  ipcMain.handle(
    'ai:tool-confirm',
    (event, requestId: string, callId: string, approved: boolean) => {
      if (
        !IdStrSchema.safeParse(requestId).success ||
        !IdStrSchema.safeParse(callId).success ||
        typeof approved !== 'boolean'
      ) {
        return;
      }
      // Verify the sender owns this request
      const windowId = event.sender.id;
      if (!activeHandles.get(windowId)?.has(requestId)) return;

      const resolve = pendingConfirmations.get(requestId)?.get(callId);
      if (resolve) {
        resolve(approved);
        pendingConfirmations.get(requestId)!.delete(callId);
      }
    }
  );

  // ─── Renderer tool result ──────────────────────────────
  ipcMain.handle(
    'ai:tool-renderer-result',
    (
      event,
      requestId: string,
      callId: string,
      result: { ok: boolean; content: string; error?: string }
    ) => {
      if (
        !IdStrSchema.safeParse(requestId).success ||
        !IdStrSchema.safeParse(callId).success ||
        !RendererToolResultSchema.safeParse(result).success
      ) {
        return;
      }
      // Verify the sender owns this request
      const windowId = event.sender.id;
      if (!activeHandles.get(windowId)?.has(requestId)) return;

      const resolve = pendingRendererResults.get(callId);
      if (resolve) {
        resolve(result);
        pendingRendererResults.delete(callId);
      }
    }
  );

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

// ─── Confirmation helper ─────────────────────────────────

function waitForConfirmation(requestId: string, callId: string): Promise<boolean> {
  return new Promise<boolean>(resolve => {
    if (!pendingConfirmations.has(requestId)) {
      pendingConfirmations.set(requestId, new Map());
    }
    pendingConfirmations.get(requestId)!.set(callId, resolve);

    // Timeout auto-rejects
    setTimeout(() => {
      const pending = pendingConfirmations.get(requestId)?.get(callId);
      if (pending) {
        pendingConfirmations.get(requestId)!.delete(callId);
        resolve(false);
      }
    }, CONFIRM_TIMEOUT_MS);
  });
}

// ─── Execute tool in renderer ────────────────────────────

export function executeToolInRenderer(
  sender: Electron.WebContents,
  requestId: string,
  callId: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<{ ok: boolean; content: string; error?: string }> {
  return new Promise(resolve => {
    pendingRendererResults.set(callId, resolve);
    sender.send('ai:tool-execute-in-renderer', requestId, callId, toolName, args);

    setTimeout(() => {
      if (pendingRendererResults.has(callId)) {
        pendingRendererResults.delete(callId);
        resolve({ ok: false, content: 'Renderer tool timed out', error: 'Timeout' });
      }
    }, RENDERER_TOOL_TIMEOUT_MS);
  });
}

// ─── Stream consumer with batching ────────────────────────

async function consumeStream(
  sender: Electron.WebContents,
  handle: ChatHandle | ToolChatHandle
): Promise<void> {
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
