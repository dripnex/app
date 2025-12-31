# IPC Contract

Electron's Inter-Process Communication (IPC) connects the renderer to the main process.

## Architecture

```
Renderer (React)
    ↓ window.readied.notes.create()
Preload (Bridge)
    ↓ ipcRenderer.invoke('notes:create')
Main (Handlers)
    ↓ createNoteOperation()
Core + Storage
```

## Preload API

The preload script exposes a typed API:

```typescript
interface ReadiedAPI {
  notes: {
    create: (input: CreateInput) => Promise<Result<NoteSnapshot>>;
    get: (id: string) => Promise<Result<NoteSnapshot>>;
    update: (input: UpdateInput) => Promise<Result<NoteSnapshot>>;
    delete: (id: string) => Promise<Result<void>>;
    archive: (id: string) => Promise<Result<NoteSnapshot>>;
    restore: (id: string) => Promise<Result<NoteSnapshot>>;
    list: (options?: ListOptions) => Promise<NoteSnapshot[]>;
    search: (query: string) => Promise<NoteSnapshot[]>;
    tags: () => Promise<string[]>;
    count: () => Promise<NoteCounts>;
  };
  data: {
    backup: () => Promise<BackupResult>;
    export: () => Promise<ExportResult>;
    import: () => Promise<ImportResult>;
    paths: () => Promise<DataPaths>;
    openFolder: () => Promise<void>;
  };
  app: {
    version: () => string;
  };
}

// Exposed as window.readied
contextBridge.exposeInMainWorld('readied', api);
```

## Main Process Handlers

```typescript
// Register handlers on app ready
ipcMain.handle('notes:create', async (_event, input) => {
  return createNoteOperation(input, noteRepository);
});

ipcMain.handle('notes:list', async (_event, options) => {
  const notes = await noteRepository.list(options);
  return notes.map(toSnapshot);
});
```

## Security Rules

| Rule               | Description                      |
| ------------------ | -------------------------------- |
| No nodeIntegration | Renderer is sandboxed            |
| contextIsolation   | Preload runs in isolated context |
| No executeSQL      | Raw SQL never exposed            |
| Typed channels     | All IPC is typed                 |

## Usage in Renderer

```typescript
// In React component
const result = await window.readied.notes.create({
  content: '# Hello World',
});

if (result.ok) {
  console.log('Created:', result.data.id);
}
```
