/**
 * Electron Main Process
 *
 * Initializes the app, database, and IPC handlers.
 * Handler logic is in apps/desktop/src/main/handlers/*.ts
 */

// Initialize Sentry FIRST (before any other imports that might throw)
// eslint-disable-next-line import-x/order
import { initSentry } from './sentry';
initSentry();

import { join, normalize } from 'path';
import { pathToFileURL } from 'url';
import { existsSync } from 'fs';
import {
  app,
  BrowserWindow,
  ipcMain,
  protocol,
  net,
  nativeTheme,
  globalShortcut,
  screen,
  shell,
} from 'electron';
import { runMigrations, createDataPaths, type DataPaths } from '@readied/storage-core';
import {
  createDatabase,
  allMigrations,
  SQLiteNoteRepository,
  SQLiteNotebookRepository,
} from '@readied/storage-sqlite';
import { createNoteId, createNoteOperation, type NoteStatus } from '@readied/core';
import { initLogger, getLogger, loggers } from './logger';
import { TokenStorage } from './services/tokenStorage.js';
import { AiKeyStorage } from './services/aiKeyStorage.js';
import { FileLicenseStorage } from './services/fileLicenseStorage.js';
import { loadWindowState, saveWindowState } from './services/windowState.js';
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
import { registerAiKeyHandlers } from './handlers/aiKeyHandlers.js';
import { startPluginWatcher, stopPluginWatcher } from './pluginWatcher.js';
import { createAIService, getToolRegistry } from './ai/setup.js';
import { registerBuiltInTools } from './ai/built-in-tools.js';
import { registerAIHandlers as registerAIHandlersNew } from './ai/ipc-ai.js';
import { registerLocalServerHandlers, stopLocalServer } from './handlers/localServerHandlers.js';

// ============================================================================
// Global State
// ============================================================================

let db: ReturnType<typeof createDatabase> | null = null;
let noteRepository: SQLiteNoteRepository | null = null;
let notebookRepository: SQLiteNotebookRepository | null = null;
let dataPaths: DataPaths | null = null;
let licenseStorage: FileLicenseStorage | null = null;

// Backend API services (initialized on app ready)
let tokenStorage: TokenStorage | null = null;
let deviceInfo: DeviceInfo | null = null;
let apiClient: ApiClient | null = null;
let encryptionService: EncryptionService | null = null;
let syncService: SyncService | null = null;
let aiKeyStorage: AiKeyStorage | null = null;

// Pending deep link token — stored if the deep link arrives before the window is ready
let pendingAuthToken: string | null = null;
// Set of webContents IDs allowed to close themselves via window:closeSelf
const closableWindowIds = new Set<number>();
// Git service (initialized on app ready)
let gitService: GitService | null = null;

// ============================================================================
// Shared Helpers (exported for handler modules)
// ============================================================================

/** Safely send IPC message to all windows, ignoring destroyed ones */
export function broadcastToWindows(channel: string, ...args: unknown[]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    try {
      if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
        win.webContents.send(channel, ...args);
      }
    } catch {
      // Window was destroyed between check and send — ignore
    }
  }
}

/** Helper to convert a Note to a snapshot for IPC */
export function noteToSnapshot(note: {
  id: string;
  notebookId: string;
  content: string;
  title: string;
  isPinned: boolean;
  isDeleted: boolean;
  status: NoteStatus;
  metadata: {
    createdAt: string;
    updatedAt: string;
    tags: readonly string[];
    wordCount: number;
    archivedAt: string | null;
  };
}) {
  return {
    id: note.id,
    notebookId: note.notebookId,
    content: note.content,
    title: note.title,
    createdAt: note.metadata.createdAt,
    updatedAt: note.metadata.updatedAt,
    tags: [...note.metadata.tags],
    wordCount: note.metadata.wordCount,
    archivedAt: note.metadata.archivedAt,
    isArchived: note.metadata.archivedAt !== null,
    isPinned: note.isPinned,
    isDeleted: note.isDeleted,
    status: note.status,
  };
}

// File-based license storage and window state persistence live in
// dedicated modules under ./services/. See:
//   - services/fileLicenseStorage.ts
//   - services/windowState.ts

// ============================================================================
// Initialization
// ============================================================================

/** Initialize data paths */
function initDataPaths(): DataPaths {
  const userDataPath = app.getPath('userData');
  return createDataPaths(userDataPath);
}

/** Initialize the database */
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

  // Initialize Git service for git-backed notebooks
  gitService = new GitService(dataPaths.root);

  dbLog.info('Database initialized');
}

// ============================================================================
// Network guards
// ============================================================================

/** Is this IPv4 (as 4 octet numbers) loopback/private/link-local/unspecified? */
function isBlockedIPv4(o: number[]): boolean {
  if (o.length !== 4 || o.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return true; // malformed → block
  const a = o[0]!;
  const b = o[1]!;
  if (a === 127) return true; // loopback 127.0.0.0/8
  if (a === 10) return true; // private 10/8
  if (a === 0) return true; // "this host" 0.0.0.0/8
  if (a === 192 && b === 168) return true; // private 192.168/16
  if (a === 169 && b === 254) return true; // link-local incl. metadata 169.254.169.254
  if (a === 172 && b >= 16 && b <= 31) return true; // private 172.16/12
  return false;
}

/**
 * SSRF guard: block hostnames that point at loopback, private, or link-local
 * ranges (incl. the cloud metadata endpoint 169.254.169.254). Used to keep
 * `editor:fetchUrlTitle` from being pointed at internal services.
 *
 * IP-aware: range checks apply ONLY when the host is an actual IP literal, so
 * ordinary domains that merely start with "fc"/"fd" (fc2.com, fdroid.org) are
 * not over-blocked. Handles IPv4-mapped IPv6 (e.g. `[::ffff:127.0.0.1]`, which
 * the WHATWG URL parser normalizes to `::ffff:7f00:1`) so those can't bypass it.
 *
 * Note: literal host only; does not defend against DNS rebinding or a public
 * host redirecting to an internal one — a follow-up could resolve + pin the IP
 * and validate each redirect hop.
 */
function isBlockedFetchHost(hostname: string): boolean {
  const h = hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, '') // strip IPv6 brackets
    .replace(/\.$/, ''); // strip a trailing root dot (localhost. / 127.0.0.1. must not bypass)
  if (h === '' || h === 'localhost' || h.endsWith('.localhost')) return true;

  // IPv4 literal (dotted quad)
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (v4) return isBlockedIPv4([+v4[1]!, +v4[2]!, +v4[3]!, +v4[4]!]);

  // IPv6 literal (only branch that inspects hex prefixes)
  if (h.includes(':')) {
    if (h === '::1' || h === '::') return true; // loopback / unspecified
    // IPv4-mapped, dotted form: ::ffff:127.0.0.1
    const mapDotted = /(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
    if (mapDotted)
      return isBlockedIPv4([+mapDotted[1]!, +mapDotted[2]!, +mapDotted[3]!, +mapDotted[4]!]);
    // IPv4-mapped, hex form (URL parser output): ::ffff:7f00:1
    const mapHex = /::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(h);
    if (mapHex) {
      const hi = parseInt(mapHex[1]!, 16);
      const lo = parseInt(mapHex[2]!, 16);
      return isBlockedIPv4([hi >> 8, hi & 0xff, lo >> 8, lo & 0xff]);
    }
    if (/^fe[89ab]/.test(h)) return true; // link-local fe80::/10 (fe80–febf)
    if (/^f[cd]/.test(h)) return true; // unique-local fc00::/7
    return false;
  }

  // Ordinary domain — not blocked here (SSRF for domains would need DNS resolution).
  return false;
}

// ============================================================================
// Window Creation
// ============================================================================

/** Create the main window */
function createWindow(): void {
  // Load saved window state
  const windowState = loadWindowState();

  const mainWindow = new BrowserWindow({
    x: windowState.x,
    y: windowState.y,
    width: windowState.width,
    height: windowState.height,
    minWidth: 800,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 8, y: 8 },
    backgroundColor: '#0a0b0d',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Required for better-sqlite3
    },
  });

  // Restore maximized state after window is created
  if (windowState.isMaximized) {
    mainWindow.maximize();
  }

  // Save window state on resize/move/close (debounced)
  let saveTimeout: NodeJS.Timeout | null = null;
  const debouncedSave = () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      if (!mainWindow.isDestroyed() && !mainWindow.isMaximized()) {
        const bounds = mainWindow.getBounds();
        saveWindowState({
          ...bounds,
          isMaximized: false,
        });
      }
    }, 500);
  };

  mainWindow.on('resize', debouncedSave);
  mainWindow.on('move', debouncedSave);

  mainWindow.on('maximize', () => {
    if (mainWindow.isDestroyed()) return;
    saveWindowState({
      ...mainWindow.getBounds(),
      isMaximized: true,
    });
  });

  mainWindow.on('unmaximize', () => {
    if (mainWindow.isDestroyed()) return;
    saveWindowState({
      ...mainWindow.getBounds(),
      isMaximized: false,
    });
  });

  mainWindow.on('ready-to-show', () => {
    if (mainWindow.isDestroyed()) return;
    mainWindow.show();
  });

  // Deliver any pending deep link auth token once the renderer is ready.
  // Guard against window destruction — did-finish-load can fire late during
  // app shutdown or auto-update restart, and the captured `mainWindow` ref
  // would throw 'Object has been destroyed' on .send/.show/.focus.
  mainWindow.webContents.on('did-finish-load', () => {
    if (!pendingAuthToken) return;
    if (mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) return;
    getLogger().info('Delivering queued auth token to renderer');
    mainWindow.webContents.send('auth:verify-token', pendingAuthToken);
    mainWindow.show();
    mainWindow.focus();
    pendingAuthToken = null;
  });

  // Load renderer
  if (process.env.NODE_ENV === 'development' && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

/** Create a new window for viewing a single note */
function createNoteWindow(noteId: string, noteTitle: string): void {
  const noteWindow = new BrowserWindow({
    width: 800,
    height: 700,
    minWidth: 500,
    minHeight: 400,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 8, y: 8 },
    backgroundColor: '#0a0b0d',
    title: noteTitle || 'Note',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  noteWindow.on('ready-to-show', () => {
    if (noteWindow.isDestroyed()) return;
    noteWindow.show();
    if (process.env.NODE_ENV === 'development') {
      noteWindow.webContents.openDevTools();
    }
  });

  // Load renderer with note ID in query param
  const query = `?noteWindow=${encodeURIComponent(noteId)}`;
  if (process.env.NODE_ENV === 'development' && process.env.ELECTRON_RENDERER_URL) {
    void noteWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}${query}`);
  } else {
    void noteWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      query: { noteWindow: noteId },
    });
  }
}

// ============================================================================
// Quick Capture Window
// ============================================================================

/** Quick capture window singleton */
let quickCaptureWindow: BrowserWindow | null = null;

/** Create or focus the quick capture floating window */
function createQuickCaptureWindow(): void {
  // If window exists, focus it
  if (quickCaptureWindow && !quickCaptureWindow.isDestroyed()) {
    quickCaptureWindow.show();
    quickCaptureWindow.focus();
    return;
  }

  // Center on the current cursor screen
  const cursorPoint = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursorPoint);
  const { x, y, width, height } = display.workArea;
  const winWidth = 480;
  const winHeight = 340;

  quickCaptureWindow = new BrowserWindow({
    x: Math.round(x + (width - winWidth) / 2),
    y: Math.round(y + (height - winHeight) / 2),
    width: winWidth,
    height: winHeight,
    resizable: false,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    backgroundColor: '#0a0b0d',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  closableWindowIds.add(quickCaptureWindow.webContents.id);

  quickCaptureWindow.on('ready-to-show', () => {
    quickCaptureWindow?.show();
  });

  // Blur listener intentionally removed — closing on blur drops user input.
  // The window is closed via Escape key or explicit close/save actions.

  quickCaptureWindow.on('closed', () => {
    if (quickCaptureWindow) {
      closableWindowIds.delete(quickCaptureWindow.webContents.id);
    }
    quickCaptureWindow = null;
  });

  // Load quick capture view via query param
  if (process.env.NODE_ENV === 'development' && process.env.ELECTRON_RENDERER_URL) {
    void quickCaptureWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}?view=quick-capture`);
  } else {
    void quickCaptureWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      query: { view: 'quick-capture' },
    });
  }
}

/** Settings window singleton */
let settingsWindow: BrowserWindow | null = null;

/** Create or focus the settings window */
function createSettingsWindow(): void {
  // If window exists, focus it
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 720,
    height: 520,
    minWidth: 620,
    minHeight: 460,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 8, y: 8 },
    backgroundColor: '#0a0b0d',
    title: 'Settings',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  closableWindowIds.add(settingsWindow.webContents.id);

  settingsWindow.on('ready-to-show', () => {
    settingsWindow?.show();
    if (process.env.NODE_ENV === 'development') {
      settingsWindow?.webContents.openDevTools();
    }
  });

  settingsWindow.on('closed', () => {
    if (settingsWindow) {
      closableWindowIds.delete(settingsWindow.webContents.id);
    }
    settingsWindow = null;
  });

  // Load settings page via query param (same index.html, different view)
  if (process.env.NODE_ENV === 'development' && process.env.ELECTRON_RENDERER_URL) {
    const settingsUrl = `${process.env.ELECTRON_RENDERER_URL}?view=settings`;
    void settingsWindow.loadURL(settingsUrl);
  } else {
    void settingsWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      query: { view: 'settings' },
    });
  }
}

// ============================================================================
// Navigation hardening
// ============================================================================

/**
 * Only the app's own renderer origin (dev server) or packaged file:// loads
 * under the app's output directory. Uses parsed-origin / path-prefix checks
 * rather than string startsWith, which would let `http://localhost:5174.evil.com`
 * or `file:///etc/passwd` pass.
 */
function isInternalNavigation(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }

  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (devUrl) {
    try {
      if (u.origin === new URL(devUrl).origin) return true;
    } catch {
      // malformed dev URL — ignore
    }
  }

  if (u.protocol === 'file:') {
    // Packaged renderer is loaded from the app's `out/` dir via loadFile. Only
    // allow file:// navigations that stay within it.
    const appDirUrl = pathToFileURL(join(__dirname, '..') + '/').href;
    return u.href.startsWith(appDirUrl);
  }

  return false;
}

/** Protocols we are willing to hand off to the OS via shell.openExternal. */
function isSafeExternalUrl(url: string): boolean {
  return url.startsWith('https://') || url.startsWith('http://') || url.startsWith('mailto:');
}

// SECURITY: rendered note/AI content can contain arbitrary links (rehypeRaw is
// enabled). Deny all in-app navigation and window.open by default; route only
// vetted external URLs to the system browser. Applied to every web contents.
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });

  contents.on('will-navigate', (event, url) => {
    if (isInternalNavigation(url)) return;
    event.preventDefault();
    if (isSafeExternalUrl(url)) void shell.openExternal(url);
  });
});

// ============================================================================
// Window Management IPC (small enough to keep inline)
// ============================================================================

function registerWindowHandlers(): void {
  // Open a note in a new window
  ipcMain.handle('window:openNote', async (_event, noteId: string, noteTitle: string) => {
    createNoteWindow(noteId, noteTitle);
    return { ok: true };
  });

  // Open settings window
  ipcMain.handle('window:openSettings', async () => {
    createSettingsWindow();
    return { ok: true };
  });
}

// ============================================================================
// Protocol Registration
// ============================================================================

/**
 * asset:// protocol
 *
 * Invariant:
 * - Renderer NEVER accesses filesystem paths directly
 * - All local assets are resolved via asset:// URLs
 *
 * Rationale:
 * - Avoids file:// which is blocked in dev (http://localhost)
 * - Same behavior in dev and production
 * - Enables secure embeds (images, video, pdf)
 */
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
    scheme: 'readied',
    privileges: {
      secure: true,
      standard: true,
    },
  },
]);

// ============================================================================
// Single Instance Lock (MUST be before whenReady to prevent secondary init)
// ============================================================================

// Register as default protocol client (Windows/Linux)
if (process.defaultApp) {
  if (process.argv.length >= 2 && process.argv[1]) {
    app.setAsDefaultProtocolClient('readied', process.execPath, [process.argv[1]]);
  }
} else {
  app.setAsDefaultProtocolClient('readied');
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Secondary instance — quit immediately before any initialization
  app.quit();
}

// ============================================================================
// App Lifecycle (only runs in primary instance)
// ============================================================================

app
  .whenReady()
  .then(() => {
    if (!gotTheLock) return; // Extra guard: don't initialize if secondary
    // Initialize data paths first (creates directories)
    dataPaths = initDataPaths();

    // Register asset:// protocol handler (modern protocol.handle API)
    protocol.handle('asset', request => {
      // asset://local/noteId/filename → assets/noteId/filename
      // Strip protocol and host (local/)
      let urlPath = decodeURIComponent(new URL(request.url).pathname);
      if (urlPath.startsWith('/')) {
        urlPath = urlPath.slice(1);
      }

      // Sanitize: prevent path traversal attacks
      const safePath = normalize(urlPath).replace(/^(\.\.[/\\])+/, '');

      const filePath = join(dataPaths!.assets, safePath);

      if (!existsSync(filePath)) {
        return new Response('Not Found', { status: 404 });
      }

      return net.fetch(`file://${filePath}`);
    });

    // Initialize logger (must be after dataPaths)
    const log = initLogger({
      logsDir: dataPaths.logs,
      level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
      isDevelopment: process.env.NODE_ENV === 'development',
    });
    log.info({ dataDir: dataPaths.root }, 'Application starting');

    // Initialize database and repositories
    initDatabase();

    // Register all IPC handler modules
    registerNoteHandlers({
      noteRepository: noteRepository!,
      dataPaths,
      noteToSnapshot,
    });
    registerNotebookHandlers({
      notebookRepository: notebookRepository!,
    });
    registerGitHandlers({
      gitService: gitService!,
    });
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
    registerAIHandlersNew(createAIService(), getToolRegistry());

    // Register built-in AI tools with database access
    if (noteRepository && notebookRepository) {
      const noteRepo = noteRepository;
      const nbRepo = notebookRepository;
      registerBuiltInTools(getToolRegistry(), {
        searchNotes: async (query, limit) => {
          const notes = await noteRepo.search(query, limit);
          return notes.map(n => ({
            id: n.id,
            title: n.title,
            snippet: n.content.slice(0, 200),
          }));
        },
        readNote: async id => {
          const note = await noteRepo.get(createNoteId(id));
          if (!note) return null;
          return { id: note.id, title: note.title, content: note.content };
        },
        listNotebooks: async () => {
          const notebooks = await nbRepo.getAll();
          return notebooks.map(nb => ({ id: nb.id, name: nb.name, noteCount: 0 }));
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
    }

    // Start plugin hot-reload watcher in dev mode
    if (process.env.NODE_ENV === 'development' && dataPaths) {
      startPluginWatcher(dataPaths.plugins);
    }

    registerDataHandlers({
      dataPaths,
      noteRepository: noteRepository!,
      getDb: () => db!,
      setDb: newDb => {
        db = newDb;
      },
    });

    // Initialize license storage
    licenseStorage = new FileLicenseStorage(dataPaths.root);

    registerLogHandlers({
      getDataPaths: () => dataPaths,
    });
    registerUpdateHandlers({
      broadcastToWindows,
    });

    // App version
    ipcMain.handle('app:version', () => app.getVersion());

    // Editor: fetch URL title for auto-link on paste
    ipcMain.handle('editor:fetchUrlTitle', async (_event, url: string) => {
      try {
        // Validate URL to prevent fetching arbitrary resources
        if (typeof url !== 'string' || url.length > 2048) {
          return { title: null };
        }
        const parsed = new URL(url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          return { title: null };
        }
        // SSRF guard: refuse internal/loopback/link-local targets.
        if (isBlockedFetchHost(parsed.hostname)) {
          return { title: null };
        }
        const response = await net.fetch(url, {
          signal: AbortSignal.timeout(3000),
          headers: { 'User-Agent': 'Readied/' + app.getVersion() },
        });
        // Only parse HTML responses
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('text/html')) {
          return { title: null };
        }
        // Read only first 16KB to extract <title>
        const reader = response.body?.getReader();
        if (!reader) return { title: null };
        let html = '';
        const decoder = new TextDecoder();
        while (html.length < 16384) {
          const { done, value } = await reader.read();
          if (done) break;
          html += decoder.decode(value, { stream: true });
          // Early exit once we have </title>
          if (/<\/title>/i.test(html)) break;
        }
        reader.cancel().catch(() => {});
        const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        return { title: match?.[1]?.trim() || null };
      } catch {
        return { title: null };
      }
    });

    // Theme — sync Electron nativeTheme with renderer
    ipcMain.on('theme:set-source', (_event, source: string) => {
      if (source === 'dark' || source === 'light' || source === 'system') {
        nativeTheme.themeSource = source;
      }
    });

    // Notify all renderer windows when system theme changes
    nativeTheme.on('updated', () => {
      broadcastToWindows('theme:system-changed', nativeTheme.shouldUseDarkColors);
    });

    // Settings sync: broadcast to all windows except sender
    ipcMain.on('settings:changed', (event, settings) => {
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

    // Initialize auth and sync services
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

        const apiBaseUrl = process.env.READIED_API_URL || 'https://api.readied.app';
        apiClient = new ApiClient(apiBaseUrl, tokenStorage, deviceInfo);

        encryptionService = new EncryptionService(dataPaths.root);
        await encryptionService.initialize();

        syncService = new SyncService(
          apiClient,
          encryptionService,
          noteRepository,
          notebookRepository
        );

        // Register license handlers with dependencies
        if (licenseStorage) {
          registerLicenseHandlers({
            licenseStorage,
            apiClient,
          });
        }

        registerAuthSyncHandlers({
          apiClient,
          tokenStorage,
          syncService,
          encryptionService,
          broadcastToWindows,
        });
        registerShareHandlers({ apiClient });
        registerAiKeyHandlers({ aiKeyStorage });
        log.info('Auth and sync services initialized');
      } catch (error) {
        log.error(
          { error: error instanceof Error ? error.message : String(error) },
          'Failed to initialize auth/sync services'
        );
      }
    };

    void initAuthSync();

    log.info('All IPC handlers registered');

    // Install React DevTools in development (dynamic import keeps it out of prod bundle)
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
          /* electron-devtools-installer not available — ignore */
        });
    }

    // Register global quick capture shortcut
    const registered = globalShortcut.register('CommandOrControl+Shift+N', () => {
      createQuickCaptureWindow();
    });
    if (!registered) {
      log.warn('Failed to register global shortcut CommandOrControl+Shift+N — already in use?');
    }

    // IPC: open quick capture from renderer
    ipcMain.handle('window:openQuickCapture', async () => {
      createQuickCaptureWindow();
      return { ok: true };
    });

    // IPC: close the calling window (only allowed for quick-capture and settings windows)
    ipcMain.handle('window:closeSelf', async event => {
      const senderId = event.sender.id;
      if (!closableWindowIds.has(senderId)) {
        return { ok: false, error: 'This window is not allowed to close itself' };
      }
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win && !win.isDestroyed()) {
        win.close();
      }
      return { ok: true };
    });

    // Create window and start auto-updater
    createWindow();
    initAutoUpdater({ broadcastToWindows });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
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
  if (isQuitting) return; // Guard against re-entry
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

  // Don't close the DB here — windows are still alive and may issue IPC
  // requests (e.g. notebooks:tree on reload) until they fully unmount.
  // The DB is closed in `will-quit`, after window-all-closed has fired.
  app.quit();
});

// Close the database after all windows are gone but before the process exits.
// This avoids the "database connection is not open" race where the renderer
// fires an IPC request between db.close() and window destruction.
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

// Deep link handler for readied:// protocol (macOS)
app.on('open-url', (event, url) => {
  event.preventDefault();
  const log = getLogger();
  log.info({ url }, 'Deep link received');

  try {
    const urlObj = new URL(url);

    // Handle auth verification: readied://auth/verify?token=xxx
    if (urlObj.hostname === 'auth' && urlObj.pathname === '/verify') {
      const token = urlObj.searchParams.get('token');
      if (token) {
        log.info('Auth verification token received via deep link');

        // Send token to renderer process — queue if window isn't ready yet
        const mainWin = BrowserWindow.getAllWindows().find(
          win => !win.isDestroyed() && win.webContents.isLoading() === false
        );
        if (mainWin) {
          mainWin.webContents.send('auth:verify-token', token);
          mainWin.show();
          mainWin.focus();
        } else {
          log.info('Window not ready, queuing auth token for later delivery');
          pendingAuthToken = token;
        }
      } else {
        log.warn('Deep link missing token parameter');
      }
    } else {
      log.warn(
        { hostname: urlObj.hostname, pathname: urlObj.pathname },
        'Unknown deep link format'
      );
    }
  } catch (error) {
    log.error(
      { error: error instanceof Error ? error.message : String(error) },
      'Failed to parse deep link URL'
    );
  }
});

// Primary instance: check startup args for deep link URL (cold start on Windows/Linux)
const startupDeepLink = process.argv.find(arg => arg.startsWith('readied://'));
if (startupDeepLink) {
  try {
    const urlObj = new URL(startupDeepLink);
    if (urlObj.hostname === 'auth' && urlObj.pathname === '/verify') {
      const token = urlObj.searchParams.get('token');
      if (token) {
        pendingAuthToken = token;
      }
    }
  } catch {
    // Invalid URL in argv — ignore
  }
}

// Handle deep links forwarded from secondary instances (app already running)
app.on('second-instance', (_event, commandLine) => {
  const log = getLogger();
  const deepLinkUrl = commandLine.find(arg => arg.startsWith('readied://'));

  if (deepLinkUrl) {
    log.info({ url: deepLinkUrl }, 'Deep link received via second-instance (Windows/Linux)');

    try {
      const urlObj = new URL(deepLinkUrl);

      if (urlObj.hostname === 'auth' && urlObj.pathname === '/verify') {
        const token = urlObj.searchParams.get('token');
        if (token) {
          log.info('Auth verification token received via second-instance');

          const mainWin = BrowserWindow.getAllWindows().find(
            win => !win.isDestroyed() && win.webContents.isLoading() === false
          );
          if (mainWin) {
            mainWin.webContents.send('auth:verify-token', token);
            mainWin.show();
            mainWin.focus();
          } else {
            pendingAuthToken = token;
          }
        }
      }
    } catch (error) {
      log.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to parse deep link from second-instance'
      );
    }
  }

  // Focus the existing window
  const mainWin = BrowserWindow.getAllWindows().find(win => !win.isDestroyed());
  if (mainWin) {
    if (mainWin.isMinimized()) mainWin.restore();
    mainWin.focus();
  }
});
