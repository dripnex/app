/**
 * Electron main process: boot, protocol, lifecycle.
 * Windows live in ./windows, network guards in ./network, IPC in ./handlers.
 */

// eslint-disable-next-line import-x/order
import { initSentry } from './sentry';
initSentry();

import { join, normalize } from 'path';
import { existsSync, watch, writeFileSync } from 'fs';
import {
  app,
  BrowserWindow,
  ipcMain,
  protocol,
  net,
  nativeTheme,
  globalShortcut,
  safeStorage,
} from 'electron';
import { runMigrations, createDataPaths, type DataPaths } from '@dripnex/storage-core';
import {
  createDatabase,
  allMigrations,
  SQLiteNoteRepository,
  SQLiteNotebookRepository,
  SQLiteChunkRepository,
} from '@dripnex/storage-sqlite';
import { createNoteId, createNoteOperation, updateNoteOperation } from '@dripnex/core';
import { initLogger, getLogger, loggers, createChildLogger } from './logger';
import { TokenStorage } from './services/tokenStorage.js';
import { LocalIdentity } from './services/localIdentity.js';
import { AiKeyStorage } from './services/aiKeyStorage.js';
import { FileLicenseStorage } from './services/fileLicenseStorage.js';
import { getOrCreateDeviceInfo, type DeviceInfo } from './services/deviceInfo.js';
import { ApiClient } from './services/apiClient.js';
import { EncryptionService } from './services/encryptionService.js';
import { SyncService } from './services/syncService.js';
import { GitService } from './services/gitService.js';
import { registerLicenseHandlers } from './handlers/licenseHandlers.js';
import { registerShareHandlers } from './handlers/shareHandlers.js';
import { registerNoteHandlers } from './handlers/noteHandlers.js';
import { registerNotebookHandlers } from './handlers/notebookHandlers.js';
import { registerDataHandlers } from './handlers/dataHandlers.js';
import { registerLogHandlers } from './handlers/logHandlers.js';
import { registerUpdateHandlers, initAutoUpdater } from './handlers/updateHandlers.js';
import { registerAuthSyncHandlers } from './handlers/authSyncHandlers.js';
import { registerGitHandlers } from './handlers/gitHandlers.js';
import { registerPluginHandlers } from './handlers/pluginHandlers.js';
import { registerClipboardHandlers } from './handlers/clipboardHandlers.js';
import { registerAiKeyHandlers } from './handlers/aiKeyHandlers.js';
import { noteToSnapshot } from './handlers/noteSnapshot.js';
import { startPluginWatcher, startUserFileWatcher, stopPluginWatcher } from './pluginWatcher.js';
import { ensureUserHackFiles } from './userHackFiles.js';
import { createAIService, getToolRegistry } from './ai/setup.js';
import { registerBuiltInTools } from './ai/built-in-tools.js';
import { registerGitHubTools } from './ai/github-tools.js';
import { retrieveAskNotes } from './ai/hybrid-retriever.js';
import { createEmbeddingIndexer } from './ai/indexer.js';
import {
  applyEmbedConfig,
  embedTexts,
  getEmbedMeta,
  listEmbedCatalog,
} from './ai/embed-runtime.js';
import { registerKbHandlers } from './ai/kb-ipc.js';
import { inferEdgesFromChunks } from './ai/inferred-graph.js';
import { registerAIHandlers as registerAIHandlersNew } from './ai/ipc-ai.js';
import { registerLocalServerHandlers, stopLocalServer } from './handlers/localServerHandlers.js';
import { registerIntegrations } from './integrations/register.js';
import { isBlockedFetchHost } from './network/ssrf.js';
import { registerNavigationGuards } from './network/navigation.js';
import { broadcastToWindows } from './windows/broadcast.js';
import { resolveDockIconPath } from './windows/icons.js';
import { deliverAuthToken, parseAuthVerifyToken, queueAuthToken } from './windows/authDeepLink.js';
import {
  createMainWindow,
  registerQuickCaptureShortcut,
  registerWindowHandlers,
} from './windows/register.js';
import {
  applyDevelopmentModeFromSettings,
  registerDevelopmentMode,
} from './windows/developmentMode.js';
import { registerApplicationMenu } from './windows/applicationMenu.js';

let db: ReturnType<typeof createDatabase> | null = null;
let noteRepository: SQLiteNoteRepository | null = null;
let notebookRepository: SQLiteNotebookRepository | null = null;
let chunkRepository: SQLiteChunkRepository | null = null;
let embeddingIndexer: ReturnType<typeof createEmbeddingIndexer> | null = null;
let dataPaths: DataPaths | null = null;
let licenseStorage: FileLicenseStorage | null = null;
let tokenStorage: TokenStorage | null = null;
let deviceInfo: DeviceInfo | null = null;
let apiClient: ApiClient | null = null;
let encryptionService: EncryptionService | null = null;
let syncService: SyncService | null = null;
let aiKeyStorage: AiKeyStorage | null = null;
let gitService: GitService | null = null;

function initDataPaths(): DataPaths {
  return createDataPaths(app.getPath('userData'));
}

function initDatabase(): void {
  if (!dataPaths) {
    throw new Error('Data paths not initialized');
  }

  const dbLog = loggers.database();
  dbLog.info({ path: dataPaths.database }, 'Database path');

  db = createDatabase(dataPaths.database);
  runMigrations(db, allMigrations);
  noteRepository = new SQLiteNoteRepository(db);
  notebookRepository = new SQLiteNotebookRepository(db);
  chunkRepository = new SQLiteChunkRepository(db);
  gitService = new GitService(dataPaths.root);

  dbLog.info('Database initialized');
}

registerNavigationGuards();

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'asset',
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
  {
    scheme: 'dripnex',
    privileges: {
      secure: true,
      standard: true,
    },
  },
]);

if (process.defaultApp) {
  if (process.argv.length >= 2 && process.argv[1]) {
    app.setAsDefaultProtocolClient('dripnex', process.execPath, [process.argv[1]]);
  }
} else {
  app.setAsDefaultProtocolClient('dripnex');
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
}

app
  .whenReady()
  .then(async () => {
    if (!gotTheLock) return;
    registerDevelopmentMode();
    registerApplicationMenu({ dataRoot: () => dataPaths?.root ?? null });
    if (process.platform === 'darwin' && !app.isPackaged) {
      const dockIcon = resolveDockIconPath();
      if (dockIcon) app.dock?.setIcon(dockIcon);
    }
    dataPaths = initDataPaths();

    protocol.handle('asset', request => {
      let urlPath = decodeURIComponent(new URL(request.url).pathname);
      if (urlPath.startsWith('/')) {
        urlPath = urlPath.slice(1);
      }
      const safePath = normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
      const filePath = join(dataPaths!.assets, safePath);
      if (!existsSync(filePath)) {
        return new Response('Not Found', { status: 404 });
      }
      return net.fetch(`file://${filePath}`);
    });

    const log = initLogger({
      logsDir: dataPaths.logs,
      level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
      isDevelopment: process.env.NODE_ENV === 'development',
    });
    log.info({ dataDir: dataPaths.root }, 'Application starting');

    const externalWriteSignal = join(dataPaths.root, 'dripnex.external-write');
    if (!existsSync(externalWriteSignal)) {
      writeFileSync(externalWriteSignal, '0');
    }
    watch(externalWriteSignal, () => {
      broadcastToWindows('data:external-change', { at: Date.now() });
      embeddingIndexer?.schedule();
    });

    initDatabase();

    embeddingIndexer = createEmbeddingIndexer({
      chunks: chunkRepository!,
      getMeta: () => {
        const meta = getEmbedMeta();
        return { model: meta.model, dim: meta.dim };
      },
      embed: texts =>
        embedTexts(texts, () =>
          aiKeyStorage ? aiKeyStorage.getKey('openai') : Promise.resolve(undefined)
        ),
      log: createChildLogger({ component: 'kb' }),
    });
    embeddingIndexer.schedule();
    setInterval(() => embeddingIndexer?.schedule(), 30_000);

    const applyKbFromSettings = async (settings: unknown) => {
      const ai = (
        settings as { ai?: { embedProvider?: string; embedModel?: string; baseUrl?: string } }
      )?.ai;
      if (!ai) return;
      const { changed, meta } = applyEmbedConfig({
        provider: ai.embedProvider === 'openai' ? 'openai' : 'ollama',
        model: ai.embedModel,
        baseUrl: ai.baseUrl,
      });
      if (changed) {
        await chunkRepository?.invalidateOtherModels({ model: meta.model, dim: meta.dim });
      }
      embeddingIndexer?.schedule();
    };

    registerKbHandlers({
      status: async () => {
        const meta = getEmbedMeta();
        return {
          pending: (await chunkRepository!.countPending()) ?? 0,
          embedded: await chunkRepository!.countEmbedded({
            model: meta.model,
            dim: meta.dim,
          }),
          model: meta.model,
          provider: meta.provider,
          dim: meta.dim,
        };
      },
      reindex: () => embeddingIndexer?.schedule(),
      setEmbed: async input => {
        const { changed, meta } = applyEmbedConfig(input);
        if (changed) {
          await chunkRepository?.invalidateOtherModels({ model: meta.model, dim: meta.dim });
        }
        embeddingIndexer?.schedule();
        return { ...meta };
      },
      catalog: () => listEmbedCatalog(),
      inferredGraph: async () => {
        if (!chunkRepository || !noteRepository) return [];
        const meta = getEmbedMeta();
        const chunks = await chunkRepository.listEmbedded({
          model: meta.model,
          dim: meta.dim,
        });
        const graph = noteRepository.getGraphData();
        const existing = graph.edges.map(edge =>
          edge.source < edge.target
            ? `${edge.source}|${edge.target}`
            : `${edge.target}|${edge.source}`
        );
        return inferEdgesFromChunks(
          chunks
            .filter(chunk => chunk.embedding)
            .map(chunk => ({ noteId: chunk.noteId, embedding: chunk.embedding! })),
          existing
        );
      },
    });

    registerNoteHandlers({
      noteRepository: noteRepository!,
      dataPaths,
      noteToSnapshot,
      onNotesChanged: () => embeddingIndexer?.schedule(),
    });
    registerNotebookHandlers({
      notebookRepository: notebookRepository!,
    });
    registerGitHandlers({
      gitService: gitService!,
      getGithubToken: () => (aiKeyStorage ? aiKeyStorage.getKey('github') : Promise.resolve(null)),
    });
    registerClipboardHandlers();
    registerPluginHandlers({
      dataPaths,
      db: db!,
    });
    registerWindowHandlers();
    registerLocalServerHandlers({
      noteRepository: noteRepository!,
      dataPaths,
      noteToSnapshot,
    });
    const notesRepo = noteRepository;
    registerIntegrations({
      dataDir: dataPaths.root,
      getAppVersion: () => app.getVersion(),
      githubNotes: notesRepo
        ? {
            create: async (content, notebookId) => {
              const result = await createNoteOperation({ content, notebookId }, notesRepo);
              if (!result.ok) return null;
              writeFileSync(externalWriteSignal, `${Date.now()}\n`);
              embeddingIndexer?.schedule();
              return { id: result.data.id };
            },
            update: async (id, content) => {
              const result = await updateNoteOperation(
                { id: createNoteId(id), content },
                notesRepo
              );
              if (!result.ok) return false;
              writeFileSync(externalWriteSignal, `${Date.now()}\n`);
              embeddingIndexer?.schedule();
              return true;
            },
            get: async id => {
              const note = await notesRepo.get(createNoteId(id));
              if (!note) return null;
              return { id: note.id, content: note.content, isDeleted: note.isDeleted };
            },
          }
        : undefined,
    });
    const notesForRetrieve = noteRepository;
    const chunksForRetrieve = chunkRepository;
    const retrieveExtras =
      notesForRetrieve && chunksForRetrieve
        ? {
            listEmbedded: () => {
              const meta = getEmbedMeta();
              return chunksForRetrieve.listEmbedded({
                model: meta.model,
                dim: meta.dim,
              });
            },
            countEmbedded: () => {
              const meta = getEmbedMeta();
              return chunksForRetrieve.countEmbedded({
                model: meta.model,
                dim: meta.dim,
              });
            },
            embedQuery: async (query: string) => {
              const [vector] = await embedTexts([query], () =>
                aiKeyStorage ? aiKeyStorage.getKey('openai') : Promise.resolve(undefined)
              );
              return vector ?? [];
            },
            listForNote: (noteId: string) => chunksForRetrieve.listForNote(noteId),
          }
        : chunksForRetrieve
          ? { listForNote: (noteId: string) => chunksForRetrieve.listForNote(noteId) }
          : undefined;
    registerAIHandlersNew(createAIService(), getToolRegistry(), {
      resolveApiKey: provider =>
        aiKeyStorage ? aiKeyStorage.getKey(provider) : Promise.resolve(undefined),
      retrieve: notesForRetrieve
        ? input => retrieveAskNotes(notesForRetrieve, input, retrieveExtras)
        : undefined,
    });

    if (noteRepository && notebookRepository) {
      const noteRepo = noteRepository;
      const nbRepo = notebookRepository;
      registerBuiltInTools(getToolRegistry(), {
        searchNotes: async (query, limit) => {
          const hits = await retrieveAskNotes(
            noteRepo,
            { query, topK: limit ?? 10 },
            retrieveExtras
          );
          return hits.map(hit => ({
            id: hit.id,
            title: hit.title,
            snippet: hit.content.replace(/\s+/g, ' ').trim().slice(0, 200),
          }));
        },
        readNote: async id => {
          const note = await noteRepo.get(createNoteId(id));
          if (!note) return null;
          return { id: note.id, title: note.title, content: note.content };
        },
        listNotebooks: async () => {
          const notebooks = await nbRepo.getAll();
          const counts = noteRepo.countSummary();
          return notebooks.map(nb => ({
            id: nb.id,
            name: nb.name,
            noteCount: counts.byNotebook[nb.id] ?? 0,
          }));
        },
        createNote: async (title, content, notebookId) => {
          const result = await createNoteOperation(
            { content: `# ${title}\n\n${content}`, notebookId },
            noteRepo
          );
          if (!result.ok) {
            throw new Error('Failed to create note');
          }
          return { id: result.data.id };
        },
      });
      registerGitHubTools(getToolRegistry(), {
        getToken: () => (aiKeyStorage ? aiKeyStorage.getKey('github') : Promise.resolve(null)),
      });
    }

    if (dataPaths) {
      await ensureUserHackFiles(dataPaths.root);
      startUserFileWatcher(dataPaths.root);
      if (process.env.NODE_ENV === 'development') {
        startPluginWatcher(dataPaths.plugins);
      }
    }

    registerDataHandlers({
      dataPaths,
      noteRepository: noteRepository!,
      getDb: () => db!,
      setDb: newDb => {
        db = newDb;
      },
    });

    licenseStorage = new FileLicenseStorage(dataPaths.root);

    registerLogHandlers({
      getDataPaths: () => dataPaths,
    });
    registerUpdateHandlers({
      broadcastToWindows,
    });

    ipcMain.handle('app:version', () => app.getVersion());

    ipcMain.handle('editor:fetchUrlTitle', async (_event, url: string) => {
      try {
        if (typeof url !== 'string' || url.length > 2048) {
          return { title: null };
        }
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
        const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const raw = match?.[1]?.trim();
        if (!raw) return { title: null };
        const title = raw
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;|&apos;/g, "'")
          .replace(/[\r\n]+/g, ' ')
          .trim();
        return { title: title || null };
      } catch {
        return { title: null };
      }
    });

    ipcMain.on('theme:set-source', (_event, source: string) => {
      if (source === 'dark' || source === 'light' || source === 'system') {
        nativeTheme.themeSource = source;
      }
    });

    nativeTheme.on('updated', () => {
      broadcastToWindows('theme:system-changed', nativeTheme.shouldUseDarkColors);
    });

    ipcMain.on('settings:changed', (event, settings) => {
      applyDevelopmentModeFromSettings(settings);
      void applyKbFromSettings(settings);
      const senderWebContents = event.sender;
      for (const win of BrowserWindow.getAllWindows()) {
        try {
          if (
            win.webContents !== senderWebContents &&
            !win.isDestroyed() &&
            !win.webContents.isDestroyed()
          ) {
            win.webContents.send('settings:sync', settings);
          }
        } catch {
          // Window destroyed during iteration
        }
      }
    });

    const initAuthSync = async () => {
      if (!dataPaths) {
        log.error('Cannot initialize auth/sync services: dataPaths not initialized');
        return;
      }
      if (!noteRepository) {
        log.error('Cannot initialize sync service: noteRepository not initialized');
        return;
      }
      if (!notebookRepository) {
        log.error('Cannot initialize sync service: notebookRepository not initialized');
        return;
      }

      try {
        tokenStorage = new TokenStorage(dataPaths.root);
        aiKeyStorage = new AiKeyStorage(dataPaths.root);
        deviceInfo = await getOrCreateDeviceInfo(dataPaths.root);

        const apiBaseUrl = process.env.DRIPNEX_API_URL || 'https://api.dripnex.app';
        apiClient = new ApiClient(apiBaseUrl, tokenStorage, deviceInfo, (url, init) =>
          net.fetch(url, init)
        );

        registerAiKeyHandlers({ aiKeyStorage });
        registerShareHandlers({ apiClient });
        if (licenseStorage) {
          registerLicenseHandlers({
            licenseStorage,
            apiClient,
          });
        }

        encryptionService = new EncryptionService(dataPaths.root);
        try {
          await encryptionService.initialize();
        } catch (encError) {
          log.error(
            { error: encError instanceof Error ? encError.message : String(encError) },
            'Encryption init failed — auth handlers still registered'
          );
        }

        syncService = new SyncService(
          apiClient,
          encryptionService,
          noteRepository,
          notebookRepository
        );

        registerAuthSyncHandlers({
          apiClient,
          tokenStorage,
          syncService,
          encryptionService,
          localIdentity: new LocalIdentity(dataPaths.root),
          broadcastToWindows,
        });
        log.info(
          { encryptionAvailable: safeStorage.isEncryptionAvailable() },
          'Auth and sync services initialized'
        );
      } catch (error) {
        log.error(
          { error: error instanceof Error ? error.message : String(error) },
          'Failed to initialize auth/sync services'
        );
      }
    };

    void initAuthSync();

    log.info('All IPC handlers registered');

    if (process.env.NODE_ENV === 'development') {
      import('electron-devtools-installer')
        .then(({ default: installExt, REACT_DEVELOPER_TOOLS: RDT }) =>
          installExt(RDT)
            .then((name: unknown) =>
              log.info({ extension: String(name) }, 'DevTools extension installed')
            )
            .catch((err: Error) =>
              log.warn({ error: err.message }, 'Failed to install DevTools extension')
            )
        )
        .catch(() => {
          /* electron-devtools-installer not available */
        });
    }

    registerQuickCaptureShortcut();
    createMainWindow();
    initAutoUpdater({ broadcastToWindows });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  })
  .catch(err => {
    console.error('Failed to initialize app:', err);
    app.quit();
  });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

let isQuitting = false;
app.on('before-quit', async event => {
  if (isQuitting) return;
  isQuitting = true;
  event.preventDefault();

  globalShortcut.unregisterAll();
  stopPluginWatcher();

  try {
    await stopLocalServer();
  } catch (err) {
    getLogger().error(
      { error: err instanceof Error ? err.message : String(err) },
      'Error stopping local server during shutdown'
    );
  }

  app.quit();
});

app.on('will-quit', () => {
  if (db) {
    try {
      db.close();
      getLogger().info('Database closed');
    } catch (err) {
      getLogger().error(
        { error: err instanceof Error ? err.message : String(err) },
        'Error closing database during shutdown'
      );
    }
    db = null;
  }
});

app.on('open-url', (event, url) => {
  event.preventDefault();
  const log = getLogger();
  log.info({ url }, 'Deep link received');
  const token = parseAuthVerifyToken(url);
  if (token) {
    log.info('Auth verification token received via deep link');
    deliverAuthToken(token);
    return;
  }
  log.warn({ url }, 'Unknown deep link format');
});

const startupDeepLink = process.argv.find(arg => arg.startsWith('dripnex://'));
if (startupDeepLink) {
  const token = parseAuthVerifyToken(startupDeepLink);
  if (token) queueAuthToken(token);
}

app.on('second-instance', (_event, commandLine) => {
  const log = getLogger();
  const deepLinkUrl = commandLine.find(arg => arg.startsWith('dripnex://'));

  if (deepLinkUrl) {
    log.info({ url: deepLinkUrl }, 'Deep link received via second-instance (Windows/Linux)');
    const token = parseAuthVerifyToken(deepLinkUrl);
    if (token) {
      log.info('Auth verification token received via second-instance');
      deliverAuthToken(token);
    }
  }

  const mainWin = BrowserWindow.getAllWindows().find(
    win => !win.isDestroyed() && !win.webContents.isDestroyed()
  );
  if (mainWin) {
    if (mainWin.isMinimized()) mainWin.restore();
    mainWin.focus();
  }
});
