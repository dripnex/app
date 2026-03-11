# Readied Roadmap

> Plan de implementación para cerrar gaps con Inkdrop y llevar Readied a producción completa.

---

## Current State (v0.5.0)

**Lo que funciona:**

- Editor CodeMirror 6 con markdown preview
- Notebooks jerárquicos, tags, pinned, trash, statuses
- Plugin system básico (4 built-in + filesystem plugins)
- Sync de notas con E2E encryption (AES-256-GCM)
- Auth con magic link + JWT
- Subscription gating (Pro)
- Offline queue persistente (SQLite)
- Settings UI con plugin cards
- Command palette + keybindings
- Git-backed notebooks
- Wikilinks + backlinks + graph

**Lo que falta:**

- Sync de notebooks y tags
- Tests de sync
- Plugin registry/marketplace
- Temas como plugins
- remark/rehype hooks para plugins
- DB access para plugins
- Mobile
- Web clipper
- Delta sync
- Device management UI

---

## Phase 1 — Sync Completo (v0.6.0)

> Objetivo: sync production-ready para todas las entidades.

### 1.1 Notebook Sync

| Task                                                       | Files                                           |
| ---------------------------------------------------------- | ----------------------------------------------- |
| Backend: agregar rutas `/sync/notebooks` (GET/POST)        | `packages/api/src/routes/sync.ts`               |
| Backend: tabla `sync_notebook_log` o expandir `syncLog`    | `packages/api/src/db/schema.ts`                 |
| Service: implementar `pushNotebooks()` / `pullNotebooks()` | `apps/desktop/src/main/services/syncService.ts` |
| Encryption: encrypt notebook names antes de push           | `syncService.ts`                                |
| Conflict: detectar conflictos de rename/move/delete        | `syncService.ts`                                |

### 1.2 Tag Sync

| Task                                 | Files                             |
| ------------------------------------ | --------------------------------- |
| Backend: rutas `/sync/tags`          | `packages/api/src/routes/sync.ts` |
| Service: `pushTags()` / `pullTags()` | `syncService.ts`                  |
| Encrypt tag names + colors           | `syncService.ts`                  |
| Sync tag-note associations           | `syncService.ts` + backend        |

### 1.3 Conflict Resolution UI

| Task                                                  | Files                                                     |
| ----------------------------------------------------- | --------------------------------------------------------- |
| Mostrar banner/modal cuando hay conflictos pendientes | `apps/desktop/src/renderer/components/sync/`              |
| Diff side-by-side con highlight de cambios            | `ConflictResolver.tsx` (ya existe, verificar integración) |
| Acción: elegir local, remote, o merge manual          | `syncStore.ts`                                            |

### 1.4 Device Management

| Task                                                 | Files                                       |
| ---------------------------------------------------- | ------------------------------------------- |
| Backend: `/devices` CRUD (list, rename, revoke)      | `packages/api/src/routes/` (nuevo)          |
| UI: sección en Settings con lista de dispositivos    | `apps/desktop/src/renderer/pages/settings/` |
| Revocar dispositivo = invalidar tokens de ese device | Backend auth                                |

### 1.5 Sync Tests

| Task                                             | Files                                       |
| ------------------------------------------------ | ------------------------------------------- |
| Unit tests: SyncService push/pull/conflict cycle | `apps/desktop/src/main/services/__tests__/` |
| Unit tests: encryption round-trip                | `encryptionService.test.ts`                 |
| Unit tests: offline queue persistence + retry    | `packages/sync-core/tests/`                 |
| Integration: mock API + full sync flow           | `packages/sync-core/tests/`                 |
| Backend: test sync routes con Hono test client   | `packages/api/tests/`                       |

### 1.6 Sync Hardening

| Task                      | Descripción                                                 |
| ------------------------- | ----------------------------------------------------------- |
| Delta sync (opcional)     | Enviar diff en vez de contenido completo para notas grandes |
| Retry exponential backoff | Mejorar retry logic en offline scenarios                    |
| Sync logging              | Tabla local para debug de sync history                      |
| Bandwidth metrics         | Trackear datos enviados/recibidos por sync cycle            |

**Milestone:** Sync completo y testeado para notas + notebooks + tags.

---

## Phase 2 — Plugin System Avanzado (v0.7.0)

> Objetivo: plugin system comparable a Inkdrop.

### 2.1 Markdown Processing Hooks

| Task                                                             | Files                              |
| ---------------------------------------------------------------- | ---------------------------------- |
| Exponer `registerRemarkPlugin(plugin)` en PluginContext          | `packages/plugin-api/src/types.ts` |
| Exponer `registerRehypePlugin(plugin)` en PluginContext          | `packages/plugin-api/src/types.ts` |
| Conectar plugins de remark/rehype al pipeline de MarkdownPreview | `MarkdownPreview.tsx`              |
| Exponer `registerCodeBlockRenderer(lang, Component)`             | Para mermaid, chartjs, etc.        |

**Ejemplo de uso:**

```ts
activate(context) {
  context.registerRemarkPlugin(remarkMath);
  context.registerRehypePlugin(rehypeKatex);
  context.registerCodeBlockRenderer('mermaid', MermaidRenderer);
}
```

### 2.2 Data Access API (Read-Only)

| Task                                           | Files                               |
| ---------------------------------------------- | ----------------------------------- |
| Agregar `context.data.listNotes(options)`      | `packages/plugin-api/src/types.ts`  |
| Agregar `context.data.listNotebooks()`         | `packages/plugin-api/src/types.ts`  |
| Agregar `context.data.listTags()`              | `packages/plugin-api/src/types.ts`  |
| Agregar `context.data.getNoteCounts()`         | `packages/plugin-api/src/types.ts`  |
| IPC bridge: plugin data queries → main process | `preload/index.ts`, `main/index.ts` |

**Scope:** Read-only. Los plugins no modifican datos (markdown is sacred).

### 2.3 Theme System

| Task                                                                | Files                              |
| ------------------------------------------------------------------- | ---------------------------------- |
| Definir theme manifest (`theme.json` con type: ui/syntax/preview)   | `packages/plugin-api/src/types.ts` |
| Loader: inyectar CSS variables desde theme plugins                  | `packages/plugin-api/src/` (nuevo) |
| 3 theme types: UI (app chrome), Syntax (editor), Preview (markdown) | CSS variables                      |
| Scanner: detectar themes en `~/.config/readied/themes/`             | `pluginScanner.ts`                 |
| Settings UI: selector de tema por tipo                              | Settings sections                  |

### 2.4 Plugin Config Auto-Generated UI

| Task                                                 | Files                |
| ---------------------------------------------------- | -------------------- |
| Leer `configSchema` y generar form automáticamente   | `PluginsSection.tsx` |
| Soportar tipos: string, number, boolean, enum, range | Controls existentes  |
| Validación contra schema antes de guardar            | `PluginRegistry.ts`  |

**Nota:** Esto ya está parcialmente implementado en los plugin cards (v0.5.0). Expandir para soportar `enum` y `range`.

### 2.5 Plugin Error Isolation

| Task                                              | Files                |
| ------------------------------------------------- | -------------------- |
| Wrap `activate()` y `deactivate()` con try-catch  | `PluginRegistry.ts`  |
| Error boundary React para componentes de plugins  | `LayoutZone.tsx`     |
| UI: mostrar error badge en plugin card si crasheó | `PluginsSection.tsx` |
| Auto-disable plugin después de N crashes          | `PluginRegistry.ts`  |

### 2.6 Plugin Hot Reload (Dev Mode)

| Task                                                | Files              |
| --------------------------------------------------- | ------------------ |
| File watcher en plugins directory                   | `main/index.ts`    |
| Auto-reload plugin on file change (dev mode only)   | `pluginScanner.ts` |
| Dev tools: plugin inspector con logs en tiempo real | Nuevo componente   |

**Milestone:** Plugins pueden extender markdown, leer datos, aplicar temas, y tienen error isolation.

---

## Phase 3 — Plugin Ecosystem (v0.8.0)

> Objetivo: distribución y descubrimiento de plugins.

### 3.1 Plugin CLI (`rpm` o `readied-plugin`)

| Task                   | Descripción                                |
| ---------------------- | ------------------------------------------ |
| `rpm init`             | Scaffold nuevo plugin con template         |
| `rpm install <name>`   | Descargar e instalar plugin desde registry |
| `rpm uninstall <name>` | Remover plugin                             |
| `rpm update`           | Actualizar todos los plugins               |
| `rpm publish`          | Publicar a registry                        |
| `rpm link --dev`       | Symlink local para desarrollo              |

**Implementación:** CLI standalone en `packages/plugin-cli/`, distribuido como npm package global.

### 3.2 Plugin Registry (Backend)

| Task                                                   | Descripción                          |
| ------------------------------------------------------ | ------------------------------------ |
| API: `/plugins` — list, search, get details            | `packages/api/src/routes/plugins.ts` |
| API: `/plugins/publish` — upload new version           | Con auth de GitHub/email             |
| DB: tabla `plugins` con metadata, downloads, ratings   | Schema                               |
| Storage: plugin tarballs en R2/S3                      | Cloudflare R2                        |
| Validation: manifest check, size limits, security scan | Middleware                           |

### 3.3 In-App Plugin Browser

| Task                                            | Files                |
| ----------------------------------------------- | -------------------- |
| Settings > Plugins > "Browse" tab               | `PluginsSection.tsx` |
| Search + filtros (category, popularity, recent) | Nuevo componente     |
| Install/uninstall desde la UI                   | IPC → CLI/download   |
| Ver detalles: readme, screenshots, ratings      | Modal/panel          |
| Auto-update check on app launch                 | Main process         |

### 3.4 Plugin Dependencies

| Task                                            | Files                              |
| ----------------------------------------------- | ---------------------------------- |
| `dependencies` field en manifest                | `packages/plugin-api/src/types.ts` |
| Resolver: load order basado en dependency graph | `PluginRegistry.ts`                |
| CLI: install dependencies automáticamente       | Plugin CLI                         |

### 3.5 `init.js` Quick Hacks

| Task                                                      | Files               |
| --------------------------------------------------------- | ------------------- |
| Cargar `~/.config/readied/init.js` al startup             | `main/index.ts`     |
| Darle acceso al mismo PluginContext                       | `PluginRegistry.ts` |
| Docs: explicar init.js como alternativa a plugin completo | Docs                |

**Milestone:** Ecosistema de plugins con registry, CLI, y browser in-app.

---

## Phase 4 — Mobile (v1.0.0)

> Objetivo: app móvil con sync.

### 4.1 React Native App

| Task                                                 | Descripción                 |
| ---------------------------------------------------- | --------------------------- |
| Scaffold React Native app (Expo o bare)              | `apps/mobile/`              |
| SQLite adapter para React Native                     | `react-native-quick-sqlite` |
| Shared packages: `core`, `sync-core`, `storage-core` | Ya son pure TS              |
| Editor: CodeMirror 6 en WebView o editor nativo      | Evaluar opciones            |

### 4.2 Mobile Sync

| Task                                        | Descripción                                |
| ------------------------------------------- | ------------------------------------------ |
| Reusar `sync-core` types y engine           | Ya platform-agnostic                       |
| Implementar SyncClient para React Native    | HTTP + encryption                          |
| Encryption: react-native-crypto o WebCrypto | Evaluar                                    |
| Background sync                             | iOS: BackgroundFetch, Android: WorkManager |

### 4.3 Mobile UI

| Task               | Descripción                    |
| ------------------ | ------------------------------ |
| Notebook browser   | Lista jerárquica               |
| Note list + search | FTS con SQLite                 |
| Markdown editor    | CM6 WebView o editor nativo    |
| Preview            | React Native markdown renderer |
| Settings           | Sync, account, appearance      |

**Milestone:** App móvil funcional con sync bidireccional.

---

## Phase 5 — Polish & Growth (v1.x)

### 5.1 Web Clipper

| Task                                           | Descripción         |
| ---------------------------------------------- | ------------------- |
| Browser extension (Chrome + Firefox)           | `apps/web-clipper/` |
| Clip page as markdown (readability + turndown) | Content script      |
| Save to Readied via local HTTP API o sync API  | IPC o REST          |
| Select notebook/tags before saving             | Popup UI            |

### 5.2 Advanced Features

| Task                                             | Descripción                     |
| ------------------------------------------------ | ------------------------------- |
| Plugin API versioning (`apiVersion` en manifest) | Breaking change protection      |
| Plugin permissions/sandboxing                    | Capability-based access         |
| i18n framework para plugins                      | `context.i18n.t()`              |
| Plugin state persistence (beyond config)         | Blob/structured storage         |
| Global note events (not just current note)       | Event bus para all-notes        |
| Note version history access para plugins         | `context.data.getNoteHistory()` |

### 5.3 Marketing & Ecosystem

| Task                                         | Descripción             |
| -------------------------------------------- | ----------------------- |
| Plugin developer docs (VitePress)            | `apps/docs-site/`       |
| Plugin starter template (GitHub)             | Template repo           |
| Plugin showcase page                         | Marketing site          |
| Community plugins: mermaid, math, vim, emacs | Seeds para el ecosystem |

---

## Timeline Estimate

| Phase                          | Version | Scope                                            |
| ------------------------------ | ------- | ------------------------------------------------ |
| **Phase 1** — Sync Completo    | v0.6.0  | Notebooks + tags sync, conflict UI, tests        |
| **Phase 2** — Plugin System    | v0.7.0  | remark/rehype, data API, themes, error isolation |
| **Phase 3** — Plugin Ecosystem | v0.8.0  | CLI, registry, in-app browser, dependencies      |
| **Phase 4** — Mobile           | v1.0.0  | React Native app con sync                        |
| **Phase 5** — Polish           | v1.x    | Web clipper, advanced plugin APIs, i18n          |

---

## Priority Matrix

| Priority | Item                   | Impacto                                               |
| -------- | ---------------------- | ----------------------------------------------------- |
| **P0**   | Sync tests             | Sin tests no se puede confiar en sync para producción |
| **P0**   | Notebook + tag sync    | Usuarios esperan sync completo, no solo notas         |
| **P0**   | Conflict resolution UI | Ya existe componente, falta integrarlo bien           |
| **P1**   | remark/rehype hooks    | Desbloquea plugins de math, mermaid, diagrams         |
| **P1**   | Theme system           | Feature muy pedida, diferenciador visual              |
| **P1**   | Plugin error isolation | Un plugin roto no debería crashear la app             |
| **P1**   | Data access API        | Desbloquea analytics, dashboards, bulk operations     |
| **P2**   | Plugin CLI + registry  | Necesario para ecosystem pero no bloqueante           |
| **P2**   | Device management UI   | Nice to have, no crítico                              |
| **P2**   | Delta sync             | Optimización, no bloqueante                           |
| **P3**   | Mobile                 | Gran esfuerzo, separar como proyecto                  |
| **P3**   | Web clipper            | Buen growth feature pero no core                      |
| **P3**   | init.js                | Quick win pero baja prioridad                         |

---

## Comparación Final: Readied vs Inkdrop

| Feature         | Inkdrop                  | Readied (hoy)            | Readied (post-roadmap)       |
| --------------- | ------------------------ | ------------------------ | ---------------------------- |
| Editor          | CM5 (migrando a CM6)     | CM6                      | CM6                          |
| Local DB        | PouchDB                  | SQLite                   | SQLite                       |
| Sync            | CouchDB replication      | Custom REST (notes only) | Custom REST (full)           |
| E2E Encryption  | AES-256-GCM              | AES-256-GCM              | AES-256-GCM                  |
| Plugin system   | 100+ plugins, ipm CLI    | 4 built-in + filesystem  | Registry + CLI + marketplace |
| Themes          | UI/Syntax/Preview themes | No                       | 3 theme types                |
| Markdown hooks  | remark/rehype directo    | No                       | remark/rehype API            |
| DB access       | Full CRUD (PouchDB)      | No                       | Read-only API                |
| Mobile          | React Native             | No                       | React Native                 |
| Web clipper     | Browser extension        | No                       | Browser extension            |
| Pricing         | $9.98/month              | Free + Pro               | Free + Pro                   |
| Self-hosted     | CouchDB self-host        | No (API en Cloudflare)   | Posible                      |
| Graph/backlinks | No                       | Si                       | Si                           |
| Git versioning  | No                       | Si                       | Si                           |
| WYSIWYG tables  | Plugin comunitario       | Built-in                 | Built-in                     |
