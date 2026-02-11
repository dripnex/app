# Plugin System — Roadmap

> Plan de implementacion incremental del sistema de plugins de Readied.
> Cada fase se construye sobre la anterior. No saltar fases.

---

## Phase 1: Foundation (DONE)

Base minima para que un plugin built-in funcione end-to-end.

### Completado

| Componente | Package | Estado |
|---|---|---|
| `CommandRegistry` | `@readied/command-registry` | Done |
| `CommandDefinition` types | `@readied/command-registry` | Done |
| Editor commands (14) | `definitions/editor.ts` | Done |
| App commands (7) | `definitions/app.ts` | Done |
| `useCommandKeybindings` hook | desktop renderer | Done |
| `useCommandRegistry` hook | desktop renderer | Done |
| `PluginManifest` + `PluginContext` types | `@readied/plugin-api` | Done |
| `PluginRegistry` lifecycle | `@readied/plugin-api` | Done |
| `PluginHost` React component | `@readied/plugin-api` | Done |
| `EditorAPI` (safe subset) | `@readied/plugin-api` | Done |
| `AppAPI` (read-only) | `@readied/plugin-api` | Done |
| `LayoutManager` + zones (6) | `@readied/plugin-api` | Done |
| `editorPluginStore` (CM6 extensions) | `@readied/plugin-api` | Done |
| Word Count plugin (example) | `plugins/wordCount.tsx` | Done |
| Command Palette (`Cmd+P`) | `CommandPalette.tsx` | Done |

### Architecture snapshot

```
PluginHost (React, headless)
  └── PluginRegistry
        ├── load(manifest) → state: loaded
        ├── activate(id) → state: active
        │     Creates PluginContext:
        │       ├── layout: LayoutManager (per-plugin)
        │       ├── editor: EditorAPI (safe view ops)
        │       ├── registerExtensions() → CM6 compartment
        │       ├── config: PluginConfigAPI (stub)
        │       ├── log: PluginLogger
        │       └── app: AppAPI (read-only)
        └── deactivate(id) → cleanup layout, extensions, disposable
```

### Layout zones disponibles

| Zone | Donde aparece |
|---|---|
| `sidebar-section` | Sidebar widgets |
| `editor-toolbar` | Formatting toolbar additions |
| `editor-status-bar` | Status bar (word count vive aca) |
| `editor-header-actions` | Header button area |
| `panel` | Floating/docked panels |
| `modal` | Modal dialogs |

### Stubs / deuda tecnica de Phase 1

- ~~`PluginConfigAPI.get()` → siempre retorna `undefined`~~ (resuelto Phase 2.2)
- ~~`PluginConfigAPI.set()` → no-op~~ (resuelto Phase 2.2)
- ~~No hay validacion de manifest (id unico, version semver, etc.)~~ (resuelto Phase 2.3)
- Plugins solo se cargan desde codigo (array en `App.tsx`)

---

## Phase 2: Plugin Commands + Config Persistence (DONE)

**Goal:** Plugins pueden registrar commands propios que aparecen en el Command Palette, y guardar configuracion.

### 2.1 Plugin Command Registration (DONE)

Permitir que plugins registren commands en el `CommandRegistry` global.

**Cambios:**

1. **Extender `PluginContext`** con `commands: PluginCommandAPI`

```ts
// packages/plugin-api/src/types.ts
interface PluginCommandAPI {
  register(command: {
    id: string;           // se prefija automatico: "plugin:{pluginId}:{id}"
    name: string;
    category?: CommandCategory;
    keybinding?: KeyBinding;
    icon?: string;
    execute: () => boolean | void;
  }): () => void;         // retorna unregister
}
```

2. **PluginRegistry.activate()** — crear `PluginCommandAPI` que:
   - Prefija IDs: `plugin:word-count:toggle` (evita colisiones)
   - Registra en el singleton `CommandRegistry`
   - Trackea registros para cleanup en `deactivate()`
   - Setea `showInPalette: true` por default

3. **Command Palette** — ya funciona. Los plugin commands aparecen automaticamente porque filtra `registry.getAll()`.

**Archivos a tocar:**
- `packages/plugin-api/src/types.ts` — agregar `PluginCommandAPI` a `PluginContext`
- `packages/plugin-api/src/lifecycle/PluginRegistry.ts` — crear command API en activate
- `packages/command-registry/src/types.ts` — agregar category `'plugin'` (opcional)

**Test:** Un plugin de ejemplo que registra un command y aparece en `Cmd+P`.

### 2.2 Config Persistence (DONE)

Implementar `PluginConfigAPI` real con persistencia en SQLite.

**Cambios:**

1. **Migration nueva** en `storage-sqlite` — tabla `plugin_config`:

```sql
CREATE TABLE plugin_config (
  plugin_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,  -- JSON serialized
  PRIMARY KEY (plugin_id, key)
);
```

2. **IPC bridge** en main process:

```ts
// preload
pluginConfig: {
  get(pluginId: string, key: string): Promise<unknown>;
  set(pluginId: string, key: string, value: unknown): Promise<void>;
  getAll(pluginId: string): Promise<Record<string, unknown>>;
  clear(pluginId: string): Promise<void>;
}
```

3. **PluginRegistry** — pasar config real al PluginContext:

```ts
config: {
  get<T>(key: string): T | undefined {
    // sync read from cache (hydrated on activate)
    return cache[key] as T;
  },
  set(key: string, value: unknown) {
    cache[key] = value;
    void window.readied.pluginConfig.set(pluginId, key, value);
  },
}
```

4. **Hydration:** Al activar un plugin, pre-cargar su config desde SQLite y meterla en un cache sync.

**Archivos a tocar:**
- `packages/storage-sqlite/src/migrations/` — nueva migration
- `apps/desktop/src/main/` — IPC handlers
- `apps/desktop/src/preload/` — expose pluginConfig
- `packages/plugin-api/src/lifecycle/PluginRegistry.ts` — config real

**Test:** Word Count plugin con config `showChars: boolean` que persiste entre reinicios.

### 2.3 Manifest Validation (DONE)

Validar manifests antes de cargar.

```ts
// packages/plugin-api/src/validation.ts
function validateManifest(m: unknown): PluginManifest | Error {
  // id: non-empty string, kebab-case
  // name: non-empty string
  // version: valid semver
  // activate: function
}
```

**Archivo:** `packages/plugin-api/src/validation.ts`

---

## Phase 3: Extended APIs (DONE)

**Goal:** Plugins pueden interactuar con notes, escuchar eventos, y extender el editor de formas mas ricas.

### 3.1 Extended AppAPI (DONE)

```ts
interface AppAPI {
  // Phase 1 (ya existe)
  getCurrentNote(): NoteInfo | null;
  searchNotes(query: string): Promise<NoteInfo[]>;

  // Phase 3.1 (nuevo)
  getNoteById(id: string): Promise<NoteInfo | null>;
  getNoteTags(noteId: string): Promise<string[]>;
  getBacklinks(noteId: string): Promise<Array<{ noteId: string; noteTitle: string }>>;
}
```

Principio: **read-only**. Plugins no escriben notas. La escritura se hace via EditorAPI (current note only).

### 3.2 App Events (DONE)

Events viven directamente en `AppAPI` (no en sub-objeto):

```ts
interface AppAPI {
  onNoteSelected(cb: (note: NoteInfo | null) => void): () => void;
  onNoteCreated(cb: (note: NoteInfo) => void): () => void;
  onNoteDeleted(cb: (noteId: string) => void): () => void;
}
```

Implementacion: `createAppAPI()` factory en `packages/plugin-api/src/app/createAppAPI.ts`. App.tsx crea via bridge pattern y llama `_notify*` desde handlers.

**Bug fix:** Editor event bridge — `EditorView.updateListener` registrado via `editorPluginStore` en App.tsx llama `editorAPI._notifyDocChanged()` / `_notifySelectionChanged()` (estaban sin conectar desde Phase 1).

### Completado

| Componente | Package | Estado |
|---|---|---|
| `NoteInfo` slim type | `@readied/plugin-api` | Done |
| `createAppAPI()` factory | `@readied/plugin-api` | Done |
| `AppAPIWithEvents` + `AppAPIBridge` | `@readied/plugin-api` | Done |
| Extended `AppAPI` (getNoteById, getNoteTags, getBacklinks) | `@readied/plugin-api` | Done |
| App events (onNoteSelected, onNoteCreated, onNoteDeleted) | `@readied/plugin-api` | Done |
| Bridge wiring in App.tsx | `@readied/desktop` | Done |
| Editor event bridge (doc/selection changed) | `@readied/desktop` | Done |

### 3.3 Editor Decorations API (deferred)

```ts
interface EditorDecorationAPI {
  addLineHighlight(line: number, className: string): () => void;
  addWidget(pos: number, component: ComponentType): () => void;
}
```

Wrapper sobre CM6 `Decoration` + `WidgetType`. Solo cuando un plugin real lo necesite.

### 3.4 More Layout Zones (deferred)

Nuevas zones segun necesidad:

| Zone | Cuando |
|---|---|
| `settings-section` | Cuando exista UI de plugin settings |
| `note-list-footer` | Si un plugin necesita mostrar info debajo de la lista |
| `command-palette-footer` | Acciones custom en el palette |

No crear zones anticipadamente. Solo cuando un plugin real las necesite.

---

## Phase 4: Plugin Discovery + Loading (DONE)

**Goal:** Cargar plugins desde el filesystem, no solo desde el bundle.

### Completado

| Componente | Package | Estado |
|---|---|---|
| `plugins` path en `DataPaths` | `@readied/storage-core` | Done |
| `plugin_registry` migration | `@readied/storage-sqlite` | Done |
| `pluginScanner.ts` (filesystem scan) | `@readied/desktop` main | Done |
| Plugin IPC handlers (scan, enable, disable, listState) | `@readied/desktop` main | Done |
| Preload `plugins` API bridge | `@readied/desktop` preload | Done |
| `loadPluginFromSource()` (CJS eval via `new Function`) | `@readied/plugin-api` | Done |
| `useDiscoveredPlugins` hook | `@readied/desktop` renderer | Done |
| Discovered plugins wired into `PluginHost` | `@readied/desktop` renderer | Done |
| Plugins section in SettingsModal (list + toggle) | `@readied/desktop` renderer | Done |
| `CommandRegistry` snapshot caching (fix infinite re-render) | `@readied/command-registry` | Done |

### Architecture

```
Filesystem                    Main Process              Renderer
─────────                    ────────────              ────────
plugins/
  my-plugin/
    manifest.json  ──scan──▶ Read manifest.json
    index.js       ──read──▶ Read JS as string ──IPC──▶ new Function() evaluate
                                                       → PluginManifest object
                                                       → PluginRegistry.load()
                                                       → PluginRegistry.activate()
```

### Plugin format

```
~/Library/Application Support/@readied/desktop/plugins/
  my-plugin/
    manifest.json    # { id, name, version, main }
    index.js         # Pre-bundled CJS module
```

### Security Model

Fase inicial: **trusted plugins only**. No sandbox.

- Plugins corren en el renderer process (necesitan DOM/React/CM6)
- Main process lee JS como string, renderer evalua via `new Function()`
- Solo se cargan plugins instalados manualmente por el usuario
- La API surface limita que pueden hacer (no acceso directo a SQLite o fs)
- Futuro: evaluar Workers o proceso separado si el modelo de amenaza lo requiere

### Key decisions

| Decision | Rationale |
|---|---|
| Main reads JS, renderer evals via `new Function()` | `contextIsolation: true` blocks `require()`. Renderer needs DOM/CM6. |
| `plugin_registry` table for enable/disable | Persists across restarts. Separate from `plugin_config`. |
| No row = enabled by default | User installed it → they want it. Only persist when explicitly disabled. |
| Cached snapshot in `CommandRegistry` | `useSyncExternalStore` requires referential stability. |

---

## Phase 5: Plugin Ecosystem (futuro lejano)

- Plugin registry/marketplace (HTTP API + UI)
- Auto-update de plugins
- Plugin templates / scaffolding CLI
- Inter-plugin communication (message bus)
- Plugin permissions model
- Plugin sandboxing real

**No planear detalles hasta que Phase 4 este en produccion.**

---

## Principios de diseno

1. **Incremental.** Cada fase debe funcionar standalone. No construir para Phase 5 en Phase 2.
2. **Safe by default.** Plugins reciben APIs controladas, no acceso raw.
3. **Offline-first.** Nada del plugin system requiere internet.
4. **Core is pure.** `packages/core` nunca depende del plugin system.
5. **Cleanup guaranteed.** Todo lo que un plugin registra se limpia en `deactivate()`.
6. **Convention over configuration.** Prefijos automaticos, defaults sensibles.
7. **One built-in plugin = one proof.** Cada API nueva necesita un plugin built-in que la use.

---

## Decision log

| Decision | Alternativa rechazada | Razon |
|---|---|---|
| Plugins en renderer process | Proceso separado | Simplicidad. Re-evaluar en Phase 5 |
| `PluginConfigAPI` sync get, async set | Full async | Plugins necesitan config sync en render. Cache hydrated en activate |
| Command IDs prefijados | Namespace libre | Prevenir colisiones. `plugin:{pluginId}:{commandId}` |
| Read-only AppAPI | Full CRUD | Principio de minimo privilegio. Escritura solo via EditorAPI |
| No manifest.json en Phase 1-2 | JSON desde el inicio | Built-in plugins no necesitan JSON. Lo agregamos en Phase 4 |
| Layout zones on-demand | Pre-crear todas | YAGNI. Solo crear zones cuando un plugin real las necesite |
