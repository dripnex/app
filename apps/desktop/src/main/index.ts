/**
 * Electron Main Process
 *
 * Initializes the app, database, and IPC handlers.
 */

import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { createDatabase, runMigrations, allMigrations } from '@readied/storage'
import { SQLiteNoteRepository } from '@readied/storage'
import {
  createNoteOperation,
  updateNoteOperation,
  deleteNoteOperation,
  getNoteOperation,
  archiveNoteOperation,
  restoreNoteOperation,
  duplicateNoteOperation,
} from '@readied/core'
import { createNoteId } from '@readied/core'

// Database and repository (initialized on app ready)
let db: ReturnType<typeof createDatabase> | null = null
let noteRepository: SQLiteNoteRepository | null = null

/** Get the database path based on OS */
function getDatabasePath(): string {
  const userDataPath = app.getPath('userData')
  return join(userDataPath, 'readied.db')
}

/** Initialize the database */
function initDatabase(): void {
  const dbPath = getDatabasePath()
  console.log(`[Main] Database path: ${dbPath}`)

  db = createDatabase(dbPath)
  runMigrations(db, allMigrations)
  noteRepository = new SQLiteNoteRepository(db)

  console.log('[Main] Database initialized')
}

/** Create the main window */
function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#0a0b0d',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Required for better-sqlite3
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Load renderer
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

/** Register IPC handlers for notes CRUD */
function registerIpcHandlers(): void {
  if (!noteRepository) {
    throw new Error('Note repository not initialized')
  }

  const repo = noteRepository

  // Create note
  ipcMain.handle('notes:create', async (_event, input: { content: string; id?: string }) => {
    return createNoteOperation(input, repo)
  })

  // Get note
  ipcMain.handle('notes:get', async (_event, id: string) => {
    const noteId = createNoteId(id)
    return getNoteOperation({ id: noteId }, repo)
  })

  // Update note
  ipcMain.handle('notes:update', async (_event, input: { id: string; content: string }) => {
    const noteId = createNoteId(input.id)
    return updateNoteOperation({ id: noteId, content: input.content }, repo)
  })

  // Delete note
  ipcMain.handle('notes:delete', async (_event, id: string) => {
    const noteId = createNoteId(id)
    return deleteNoteOperation({ id: noteId }, repo)
  })

  // Archive note
  ipcMain.handle('notes:archive', async (_event, id: string) => {
    const noteId = createNoteId(id)
    return archiveNoteOperation({ id: noteId }, repo)
  })

  // Restore note
  ipcMain.handle('notes:restore', async (_event, id: string) => {
    const noteId = createNoteId(id)
    return restoreNoteOperation({ id: noteId }, repo)
  })

  // Duplicate note
  ipcMain.handle('notes:duplicate', async (_event, id: string) => {
    const noteId = createNoteId(id)
    return duplicateNoteOperation({ id: noteId }, repo)
  })

  // List notes
  ipcMain.handle('notes:list', async (_event, options?: {
    limit?: number
    offset?: number
    tag?: string
    sortBy?: 'createdAt' | 'updatedAt' | 'title'
    sortOrder?: 'asc' | 'desc'
    archived?: 'active' | 'archived' | 'all'
  }) => {
    const notes = await repo.list(options)
    // Return as snapshots (serialize for IPC)
    return notes.map(note => ({
      id: note.id,
      content: note.content,
      title: note.metadata.title,
      createdAt: note.metadata.createdAt,
      updatedAt: note.metadata.updatedAt,
      tags: [...note.metadata.tags],
      wordCount: note.metadata.wordCount,
      archivedAt: note.metadata.archivedAt,
      isArchived: note.metadata.archivedAt !== null,
    }))
  })

  // Search notes
  ipcMain.handle('notes:search', async (_event, query: string, limit?: number) => {
    const notes = await repo.search(query, limit)
    return notes.map(note => ({
      id: note.id,
      content: note.content,
      title: note.metadata.title,
      createdAt: note.metadata.createdAt,
      updatedAt: note.metadata.updatedAt,
      tags: [...note.metadata.tags],
      wordCount: note.metadata.wordCount,
      archivedAt: note.metadata.archivedAt,
      isArchived: note.metadata.archivedAt !== null,
    }))
  })

  // Get all tags
  ipcMain.handle('notes:tags', async () => {
    return repo.getAllTags()
  })

  // Count notes
  ipcMain.handle('notes:count', async () => {
    const [active, archived] = await Promise.all([
      repo.count(false),
      repo.countArchived(),
    ])
    return { active, archived, total: active + archived }
  })
}

// App lifecycle
app.whenReady().then(() => {
  initDatabase()
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  if (db) {
    db.close()
    console.log('[Main] Database closed')
  }
})
