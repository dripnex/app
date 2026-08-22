# Plugin System — Roadmap

> Plan de implementacion incremental del sistema de plugins de Dripnex.
> Cada fase se construye sobre la anterior. No saltar fases.

Official first-party research (install/load as of 2026-08, [#547](https://github.com/dripnex/app/issues/547), ranked next editor/GFM packs): [`docs/plugins/`](./plugins/README.md).

---

## Phase 1: Foundation (DONE)

Base minima para que un plugin built-in funcione end-to-end.

### Completado

| Componente                               | Package                     | Estado |
| ---------------------------------------- | --------------------------- | ------ |
| `CommandRegistry`                        | `@dripnex/command-registry` | Done   |
| `CommandDefinition` types                | `@dripnex/command-registry` | Done   |
| Editor commands (14)                     | `definitions/editor.ts`     | Done   |
| App commands (7)                         | `definitions/app.ts`        | Done   |
| `useCommandKeybindings` hook             | desktop renderer            | Done   |
| `useCommandRegistry` hook                | desktop renderer            | Done   |
| `PluginManifest` + `PluginContext` types | `@dripnex/plugin-api`       | Done   |
| `PluginRegistry` lifecycle               | `@dripnex/plugin-api`       | Done   |
| `PluginHost` React component             | `@dripnex/plugin-api`       | Done   |
| `EditorAPI` (safe subset)                | `@dripnex/plugin-api`       | Done   |
| `AppAPI` (read-only)                     | `@dripnex/plugin-api`       | Done   |
| `LayoutManager` + zones (6)              | `@dripnex/plugin-api`       | Done   |
| `editorPluginStore` (CM6 extensions)     | `@dripnex/plugin-api`       | Done   |
| Word Count plugin (example)              | `plugins/wordCount.tsx`     | Done   |
| Command Palette (`Cmd+P`)                | `CommandPalette.tsx`        | Done   |

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
        │       ├── config: PluginConfigAPI (SQLite-backed)
        │       ├── log: PluginLogger
        │       └── app: AppAPI (read-only)
        └── deactivate(id) → cleanup layout, extensions, disposable
```

### Layout zones disponibles

| Zone                    | Donde aparece                    |
| ----------------------- | -------------------------------- |
| `sidebar-section`       | Sidebar widgets                  |
| `editor-toolbar`        | Formatting toolbar additions     |
| `editor-status-bar`     | Status bar (word count vive aca) |
| `editor-header-actions` | Header button area               |
| `panel`                 | Floating/docked panels           |
| `modal`                 | Modal dialogs                    |

### Stubs / deuda tecnica de Phase 1

- ~~`PluginConfigAPI.get()` → siempre retorna `undefined`~~ (resuelto Phase 2.2)
- ~~`PluginConfigAPI.set()` → no-op~~ (resuelto Phase 2.2)
- ~~No hay validacion de manifest (id unico, version semver, etc.)~~ (resuelto Phase 2.3)
- ~~Plugins solo se cargan desde codigo (array en `App.tsx`)~~ (resuelto Phase 4)

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
    id: string; // se prefija automatico: "plugin:{pluginId}:{id}"
    name: string;
    category?: CommandCategory;
    keybinding?: KeyBinding;
    icon?: string;
    execute: () => boolean | void;
  }): () => void; // retorna unregister
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
    void window.dripnex.pluginConfig.set(pluginId, key, value);
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

| Componente                                                 | Package               | Estado |
| ---------------------------------------------------------- | --------------------- | ------ |
| `NoteInfo` slim type                                       | `@dripnex/plugin-api` | Done   |
| `createAppAPI()` factory                                   | `@dripnex/plugin-api` | Done   |
| `AppAPIWithEvents` + `AppAPIBridge`                        | `@dripnex/plugin-api` | Done   |
| Extended `AppAPI` (getNoteById, getNoteTags, getBacklinks) | `@dripnex/plugin-api` | Done   |
| App events (onNoteSelected, onNoteCreated, onNoteDeleted)  | `@dripnex/plugin-api` | Done   |
| Bridge wiring in App.tsx                                   | `@dripnex/desktop`    | Done   |
| Editor event bridge (doc/selection changed)                | `@dripnex/desktop`    | Done   |

### 3.3 Editor Decorations API (DONE)

```ts
interface EditorDecorationAPI {
  addLineHighlight(line: number, className: string): () => void;
  addWidget(pos: number, dom: HTMLElement): () => void;
  clear(): void;
}
```

Wrapper sobre CM6 `Decoration` + `StateField` + `WidgetType`. Disponible en `PluginContext.decorations`. Backed by `StateEffect`s for add/remove/clear, with automatic position remapping on doc changes. Extension auto-registered in `editorPluginStore` on plugin activation.

### 3.4 More Layout Zones (DONE)

| Zone                     | Donde aparece                       |
| ------------------------ | ----------------------------------- |
| `settings-section`       | SettingsModal, antes de About       |
| `note-list-footer`       | NoteList, antes del notebook picker |
| `command-palette-footer` | CommandPalette, debajo de la lista  |

Total: 9 layout zones disponibles.

---

## Phase 4: Plugin Discovery + Loading (DONE)

**Goal:** Cargar plugins desde el filesystem, no solo desde el bundle.

### Completado

| Componente                                                  | Package                         | Estado |
| ----------------------------------------------------------- | ------------------------------- | ------ |
| `plugins` path en `DataPaths`                               | `@dripnex/storage-core`         | Done   |
| `plugin_registry` migration                                 | `@dripnex/storage-sqlite`       | Done   |
| `pluginScanner.ts` (filesystem scan)                        | `@dripnex/desktop` main         | Done   |
| Plugin IPC handlers (scan, enable, disable, listState)      | `@dripnex/desktop` main         | Done   |
| Preload `plugins` API bridge                                | `@dripnex/desktop` preload      | Done   |
| `loadPluginFromSource()` (CJS eval via `new Function`)      | `@dripnex/plugin-api`           | Done   |
| `pluginRuntimeStore` (Zustand vanilla, race-safe)           | `@dripnex/desktop` renderer     | Done   |
| Discovered plugins wired into `PluginHost`                  | `@dripnex/desktop` renderer     | Done   |
| Plugins section in SettingsApp (list + toggle + reload)     | `@dripnex/desktop` renderer     | Done   |
| Cross-window plugin reload (`plugins:requestReload` IPC)    | `@dripnex/desktop` main/preload | Done   |
| Plugin config UI from `configSchema` in manifest.json       | `@dripnex/desktop` renderer     | Done   |
| `CommandRegistry` snapshot caching (fix infinite re-render) | `@dripnex/command-registry`     | Done   |

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
~/Library/Application Support/@dripnex/desktop/plugins/
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

| Decision                                           | Rationale                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------ |
| Main reads JS, renderer evals via `new Function()` | `contextIsolation: true` blocks `require()`. Renderer needs DOM/CM6.     |
| `plugin_registry` table for enable/disable         | Persists across restarts. Separate from `plugin_config`.                 |
| No row = enabled by default                        | User installed it → they want it. Only persist when explicitly disabled. |
| Cached snapshot in `CommandRegistry`               | `useSyncExternalStore` requires referential stability.                   |

---

## Phase 4.5: Hardening (DONE)

**Goal:** Prove untested APIs, eliminate leak risks, add test coverage.

### Completado

| Componente                                                                     | Package                     | Estado |
| ------------------------------------------------------------------------------ | --------------------------- | ------ |
| Active Line Highlight plugin (proves decorations + app events + editor events) | `@dripnex/desktop` renderer | Done   |
| Event auto-cleanup in `PluginRegistry.deactivate()`                            | `@dripnex/plugin-api`       | Done   |
| Tracked event wrappers (editor + app APIs)                                     | `@dripnex/plugin-api`       | Done   |
| Test suite: validation (23 tests)                                              | `@dripnex/plugin-api`       | Done   |
| Test suite: registry lifecycle + auto-cleanup (25 tests)                       | `@dripnex/plugin-api`       | Done   |
| Test suite: loadPluginFromSource (7 tests)                                     | `@dripnex/plugin-api`       | Done   |
| Test suite: createAppAPI (9 tests)                                             | `@dripnex/plugin-api`       | Done   |
| Test suite: createEditorAPI (12 tests)                                         | `@dripnex/plugin-api`       | Done   |
| Test suite: layoutStore (9 tests)                                              | `@dripnex/plugin-api`       | Done   |
| Test suite: editorPluginStore (6 tests)                                        | `@dripnex/plugin-api`       | Done   |
| Dead code cleanup (SettingsModal.tsx + CSS)                                    | `@dripnex/desktop` renderer | Done   |

### Built-in plugins

| Plugin                | APIs probadas                                                                                              | Archivo                          |
| --------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Word Count            | layout, editor (onDocChanged, getWordCount, getCharCount, getLineCount), registerCommand                   | `plugins/wordCount.tsx`          |
| Typewriter Mode       | registerExtensions (CM6), config (persistence), registerCommand                                            | `plugins/typewriterMode.ts`      |
| Active Line Highlight | decorations (addLineHighlight), editor (onSelectionChanged), app (onNoteSelected), config, registerCommand | `plugins/activeLineHighlight.ts` |

### Event auto-cleanup

`PluginRegistry.activate()` now wraps `EditorAPI` and `AppAPI` with tracking proxies. Every `on*()` subscription is recorded. When the plugin calls the returned unsubscribe function, the tracking entry is removed. On `deactivate()`, any remaining (leaked) subscriptions are automatically unsubscribed — safety net for misbehaving plugins.

---

## Hackable files (Inkdrop-aligned)

User files in the data directory — same idea as Inkdrop's `init.js` + `styles.css`:

| File               | Role                                                                                                                                                                               |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `init.js`          | Runs on load. Free-form `dripnex.*` **or** a CJS `PluginManifest`. Open from Settings → Plugins.                                                                                   |
| `styles.css`       | Injected into every renderer window. Save to apply.                                                                                                                                |
| `keybindings.json` | Command id → chord (or `null` to unbind). Contexts: `editor`, `note-list`, `app`, `global`. `j`/`k` are `note-list` (next/prev note) and do not fire in the editor. Save to apply. |

Free-form `init.js` is wrapped as plugin `user-init`. A full manifest export still works.

These files do **not** exist until the user clicks Open. Templates are written on first open.

### Vim (community plugin)

Vim is **not** built-in. Install `dripnex/plugin-vim` (or `dripnex-plugin link` a local checkout) and enable **Vim Mode** in Settings → Plugins. Same engine as Inkdrop (`@replit/codemirror-vim`) plus:

|         |                                                                                                                           |
| ------- | ------------------------------------------------------------------------------------------------------------------------- |
| Ex      | `:w` save, `:n` / `:next` next note, `:prev` previous, `:p` / `:preview`, `:side` split, `:cmd {id}` dispatch any command |
| Options | relative line numbers, yank/delete → system clipboard                                                                     |
| Status  | `NORMAL` / `INSERT` / `VISUAL` / `REPLACE` in the editor status bar                                                       |
| Preview | `j` `k` `gg` `G` `Ctrl-d/u/f/b` when the preview is focused                                                               |

From `init.js` (after enabling the plugin):

```js
const Vim = dripnex.vim;
if (Vim) {
  Vim.map('jj', '<Esc>', 'insert');
  Vim.map('Y', 'y$');
  Vim.defineEx('find', 'f', () => {
    void dripnex.commands.dispatch('app:focus-search');
  });
}
```

### Read-only store (`dripnex.store`)

Inkdrop plugins call `inkdrop.store.getState()`. Dripnex exposes the same
_shape of access_ without Redux: a cloned snapshot of Query + Zustand.

```js
const { editingNote, notes, navigation } = dripnex.store.getState();

const unsub = dripnex.store.subscribe(() => {
  const { editingNote: next } = dripnex.store.getState();
  dripnex.log.debug(next.id, next.isDirty);
});
```

- `notes.items` is the **visible list**, not every note in the library.
- There is **no** `store.dispatch`. Use `dripnex.commands.dispatch`, `editor`, or `data`.
- `settings` is appearance only (no API keys).

State map, query keys, and CSS token owners: [`docs/state.md`](./state.md).

### CLI (`dripnex-plugin`)

Same data dir as the desktop (`@dripnex/desktop`, overridable with `DRIPNEX_DATA_DIR`):

```bash
pnpm plugin init "My Plugin"
cd my-plugin && npm install && npm run build
pnpm plugin link
# Settings → Plugins → Reload
```

Or from a built checkout: `pnpm --filter @dripnex/plugin-cli cli -- list`.

---

## Catalog: one plugin = one git repo

Inkdrop’s registry is not a folder in the app. Each community plugin is its own
repository, tagged `vX.Y.Z`, with a tarball on the GitHub Release.

```
dripnex-plugin pack
dripnex-plugin publish   # prints: git tag + gh release create
```

`bundleUrl` points at that release asset. The desktop installs over HTTPS only.
Built-ins stay in `apps/desktop` until they deserve their own repo.

### What belongs in the app

| Role                                         | Plugins                                                  | Marketing? |
| -------------------------------------------- | -------------------------------------------------------- | ---------- |
| **core**                                     | mermaid, math, tables, paste-as-link, AI                 | yes        |
| **optional**                                 | export                                                   | yes        |
| **community**                                | vim (`dripnex/plugin-vim`)                               | yes        |
| **proof** (API examples, hide from the site) | word-count, reading-time, typewriter, focus, active-line | no         |

Do not add more proof plugins to dripnex.app/plugins.

`core` mermaid/math here means the **built-in renderers**. The satellite repos `dripnex/plugin-mermaid` and `dripnex/plugin-math` only insert a fence. Vim is not built-in. Details: [`docs/plugins/official-first-party.md`](./plugins/official-first-party.md).

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

| Decision                                | Alternativa rechazada       | Razon                                                                                                   |
| --------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------- |
| Plugins en renderer process             | Proceso separado            | Simplicidad. Re-evaluar en Phase 5                                                                      |
| `PluginConfigAPI` sync get, async set   | Full async                  | Plugins necesitan config sync en render. Cache hydrated en activate                                     |
| Command IDs prefijados                  | Namespace libre             | Prevenir colisiones. `plugin:{pluginId}:{commandId}`                                                    |
| Read-only AppAPI                        | Full CRUD                   | Principio de minimo privilegio. Escritura solo via EditorAPI                                            |
| No manifest.json en Phase 1-2           | JSON desde el inicio        | Built-in plugins no necesitan JSON. Lo agregamos en Phase 4                                             |
| Layout zones on-demand                  | Pre-crear todas             | YAGNI. Solo crear zones cuando un plugin real las necesite                                              |
| `pluginRuntimeStore` (Zustand vanilla)  | React hook with `reloadKey` | Reload es infra de runtime, no UI state. Scan generation counter para race safety                       |
| Event auto-cleanup via tracked wrappers | Manual cleanup only         | Safety net: plugins that forget to unsubscribe don't leak. Zero overhead when plugins clean up properly |
