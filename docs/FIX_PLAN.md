# Plan de Remediación y Ruta al Knowledge Base — Dripnex

## Resumen ejecutivo

Este documento consolida 61 hallazgos verificados más 5 problemas de seguridad ya en curso (PR separado) y los organiza en un plan de fases orientado a un objetivo concreto: **conectar un segundo "API" (base de conocimiento) para que la IA responda directamente sobre las notas del usuario mediante RAG / búsqueda semántica**.

Conclusión central del análisis de viabilidad: hoy **no existe ninguna infraestructura de embeddings, vectores ni chunking**. La "recuperación" está partida en dos rutas ad-hoc de búsqueda por palabra clave (FTS5), una de ellas incrustada dentro de un componente React (`AiPanel.tsx:445-477`) y otra como tool en el proceso main (`built-in-tools.ts:25`). Además, el API en la nube (`packages/api`, Cloudflare Worker) es **cifrado extremo a extremo — el servidor solo ve blobs cifrados** (`routes/sync.ts:5`), por lo que **no puede** actuar como KB del lado servidor sin romper el modelo de confianza.

Por lo tanto, el "segundo API" realista y conforme a las reglas del proyecto (offline-first, core puro, deps nativas solo en `apps/desktop`) es **un índice vectorial local con proveedores de embeddings enchufables (por defecto offline, Ollama)**. El único paso que toca la red es la _generación_ de embeddings, que debe ser opt-in cuando sea en la nube.

El plan prioriza así:

1. **Estabilizar y asegurar la superficie que el KB va a heredar** (auth del servidor local, claves, panel de IA, presupuesto de tokens del tool-loop). Sin esto, RAG hereda bugs de lockup y overflow silencioso.
2. **Consolidar la recuperación** en un módulo `Retriever` único y testeable, y **limpiar las señales de grafo/tags** que RAG usará como contexto.
3. **Construir la pila de KB por capas**: `EmbeddingProvider` → esquema (chunks + vectores) → pipeline de indexación asíncrono → retriever híbrido + `ContextBuilder` consciente de chunks + IPC/settings.
4. **Saldar deuda técnica y endurecer backend** en paralelo.

Esfuerzo total estimado: ~4 fases de habilitación de KB (M–L cada una) sobre ~3 fases de estabilización previas (S–M). El bloqueante conceptual más importante no es código sino una **decisión de producto**: el KB es un índice local; cualquier pieza en la nube es solo el generador de embeddings (ver "Riesgos y decisiones abiertas").

---

## Hallazgos por severidad

### Ya confirmados — PR de seguridad en curso (NO re-planificar)

| Sev | Título                                                                        | Archivo                                                         |
| --- | ----------------------------------------------------------------------------- | --------------------------------------------------------------- |
| —   | Path traversal en git handlers                                                | `gitHandlers.ts` (IdSchema) → `gitService.ts`                   |
| —   | Clave LLM en localStorage plano                                               | `AiSection.tsx` (`updateAi`) + `settingsStore` sin `partialize` |
| —   | CSP débil (`unsafe-eval`, `img-src https:`)                                   | `renderer/index.html`                                           |
| —   | Canales `ai:chat/cancel/validate` sin Zod `defineIpcHandler`                  | AI IPC                                                          |
| —   | `rehypeRaw` sin `rehype-sanitize`; sin `setWindowOpenHandler`/`will-navigate` | `MarkdownPreview`                                               |

### Critical

| Sev      | Cat      | Título                                                                        | file:line                             |
| -------- | -------- | ----------------------------------------------------------------------------- | ------------------------------------- |
| Critical | security | Rutas admin confían en JWT sin verificar firma — se puede forjar acceso admin | `packages/api/src/routes/admin.ts:48` |

### High

| Sev  | Cat       | Título                                                                                                                          | file:line                                                 |
| ---- | --------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| High | bug       | Auth del servidor HTTP local crashea con header multibyte (`timingSafeEqual` RangeError, conexión colgada, unhandled rejection) | `apps/desktop/src/main/services/localServer.ts:148`       |
| High | bug       | Fallo de envío de comando deja `commandActiveRef` en `true` para siempre — rompe el chat en streaming                           | `apps/desktop/src/renderer/components/ai/AiPanel.tsx:375` |
| High | tech-debt | `packages/sync-core` es código muerto huérfano — el sync real vive en `SyncService` del desktop                                 | `packages/sync-core/src/engine.ts:85`                     |

### Medium

| Sev | Cat             | Título                                                                                                                          | file:line                                                              |
| --- | --------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Med | security        | `ai:chat` confía en apiKey en texto plano del renderer en vez del store seguro de main                                          | `apps/desktop/src/main/ai/ipc-ai.ts:37`                                |
| Med | bug             | `TokenStorage` borra el archivo cifrado ante **cualquier** error de descifrado (logout/pérdida de datos con keychain bloqueado) | `apps/desktop/src/main/services/tokenStorage.ts:72`                    |
| Med | gap             | Recuperación solo keyword/FTS, sin abstracción de embeddings ni semántica                                                       | `apps/desktop/src/main/ai/built-in-tools.ts:25`                        |
| Med | gap             | `ApiClient` hace requests sin timeout / AbortSignal                                                                             | `apps/desktop/src/main/services/apiClient.ts:213`                      |
| Med | gap             | Handlers IPC de auth/sync/license/share/ai-key solo se registran si el init async tiene éxito                                   | `apps/desktop/src/main/index.ts:699`                                   |
| Med | security        | `editor:fetchUrlTitle` es SSRF sin validar (sin restricción de host, salta `defineIpcHandler`)                                  | `apps/desktop/src/main/index.ts:632`                                   |
| Med | bug             | Listener `onEvent` del comando auto-ejecutado sin cleanup — fuga de listeners IPC                                               | `apps/desktop/src/renderer/components/ai/AiPanel.tsx:290`              |
| Med | missing-pattern | Listas de modelos LLM hardcodeadas en `AiSection` pese a `LLMProvider.models()`                                                 | `apps/desktop/src/renderer/pages/settings/sections/AiSection.tsx:47`   |
| Med | hardcoded       | Host de Ollama hardcodeado sin setting de configuración                                                                         | `apps/desktop/src/renderer/pages/settings/sections/AiSection.tsx:42`   |
| Med | bug             | `extractTags` dice ignorar bloques de código pero no lo hace — genera tags espurios                                             | `packages/core/src/domain/metadata.ts:53`                              |
| Med | bug             | Backlinks y grafo incluyen notas en papelera (`is_deleted`)                                                                     | `packages/storage-sqlite/src/repositories/SQLiteNoteRepository.ts:480` |
| Med | gap             | Export/Import pierde `notebookId`, `isPinned`, `isDeleted`, `status`                                                            | `packages/storage-core/src/data/Export.ts:31`                          |
| Med | bug             | `estimateMessageTokens` cuenta `tool_use`/`tool_result` como 0 tokens; el tool-loop crece sin presupuesto                       | `packages/ai-core/src/context-builder.ts:42`                           |
| Med | bug             | Tool calls de Ollama nunca disparan el tool-loop (stop reason `end_turn`)                                                       | `packages/ai-core/src/providers/ollama.ts:241`                         |
| Med | missing-pattern | La ruta de chat con tools no tiene retry (a diferencia del chat plano)                                                          | `packages/ai-core/src/ai-service.ts:138`                               |
| Med | hardcoded       | Fallback de ventana de contexto de 200 000 tokens desborda modelos pequeños                                                     | `packages/ai-core/src/ai-service.ts:113`                               |
| Med | bug             | El costo de tokens del query del usuario se excluye del presupuesto de contexto                                                 | `packages/ai-core/src/ai-service.ts:126`                               |
| Med | missing-pattern | `validateNotebookTree` duplicado inline en la ruta API en vez de importar de sync-core                                          | `packages/api/src/routes/sync.ts:264`                                  |
| Med | gap             | Rate-limit en memoria es per-isolate y efímero en Cloudflare Workers                                                            | `packages/api/src/middleware/rateLimit.ts:22`                          |
| Med | hardcoded       | Trial de 14 días hardcodeado en el API, saltando product-config                                                                 | `packages/api/src/routes/auth.ts:140`                                  |
| Med | gap             | Endpoints públicos sin rate limit; slug de nota compartida solo 32 bits                                                         | `packages/api/src/routes/share.ts:49`                                  |
| Med | bug             | `extractWikilinks()` del core matchea sintaxis embed `![[...]]` como wikilink, contamina el grafo                               | `packages/wikilinks/src/core/parsing.ts:19`                            |
| Med | gap             | No existe capa de embedding/vector/recuperación semántica — solo FTS5                                                           | `packages/mcp-server/src/index.ts:234`                                 |
| Med | missing-pattern | Tools de escritura MCP mutan el SQLite compartido directamente, saltando IPC/Zod y dejando la app con estado stale              | `packages/mcp-server/src/index.ts:161`                                 |

### Low

| Sev | Cat             | Título                                                                                                     | file:line                                                              |
| --- | --------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Low | bug             | Tool `list_notebooks` siempre reporta `noteCount: 0`                                                       | `apps/desktop/src/main/index.ts:589`                                   |
| Low | bug             | `auth:refreshToken` devuelve un objeto `RefreshResult` como flag booleano de éxito                         | `apps/desktop/src/main/handlers/authSyncHandlers.ts:137`               |
| Low | bug             | Sanitizer de `plugins:uninstall` quita caracteres que `install` permite                                    | `apps/desktop/src/main/handlers/pluginHandlers.ts:419`                 |
| Low | tech-debt       | `ApiClient` usa `cross-fetch` mientras el resto de main usa `net.fetch` de Electron                        | `apps/desktop/src/main/services/apiClient.ts:10`                       |
| Low | hardcoded       | Parsing de deep-link auth duplicado 3 veces y base URL del backend hardcodeada                             | `apps/desktop/src/main/index.ts:720`                                   |
| Low | gap             | Settings/IPC de IA sin conceptos de embedding/vector/KB                                                    | `apps/desktop/src/renderer/stores/settings/schema.ts:64`               |
| Low | hardcoded       | String de modelo por defecto hardcodeado y duplicado en AiPanel y schema                                   | `apps/desktop/src/renderer/components/ai/AiPanel.tsx:275`              |
| Low | hardcoded       | `maxResponseTokens` hardcodeado a 2048 en ambas rutas de chat                                              | `apps/desktop/src/renderer/components/ai/AiPanel.tsx:477`              |
| Low | missing-pattern | `AiMessage` hace markdown→HTML a mano con `dangerouslySetInnerHTML` en vez de `MarkdownPreview`            | `apps/desktop/src/renderer/components/ai/AiMessage.tsx:13`             |
| Low | gap             | Autosave en `beforeunload` es fire-and-forget async — riesgo de pérdida al salir                           | `apps/desktop/src/renderer/hooks/useAutoSave.ts:20`                    |
| Low | bug             | El contexto de ask-notes puede duplicar la nota actual, malgastando presupuesto                            | `apps/desktop/src/renderer/components/ai/AiPanel.tsx:424`              |
| Low | tech-debt       | Docs de `NavigationState` obsoletas (tag/search marcados "Future" pero implementados; ruta `.tsx` errónea) | `apps/desktop/src/renderer/hooks/useNavigation.ts:1`                   |
| Low | missing-pattern | 30+ métodos públicos del repo solo en la clase SQLite concreta, sin interfaz                               | `packages/storage-sqlite/src/repositories/SQLiteNoteRepository.ts:230` |
| Low | bug             | Números de versión de migraciones ordenan fuera del orden declarado (016 año 2025; 004 tras 005/006)       | `packages/storage-sqlite/src/migrations/016_tag_sync_tracking.ts:11`   |
| Low | tech-debt       | FTS5 guarda copia completa del contenido (mal etiquetado "contentless")                                    | `packages/storage-sqlite/src/migrations/008_fts5_index.ts:20`          |
| Low | gap             | Save de nota, sync de links y tags manuales no son una transacción atómica                                 | `packages/storage-sqlite/src/repositories/SQLiteNoteRepository.ts:64`  |
| Low | tech-debt       | `PRAGMA foreign_keys` off/on dentro de migración es no-op silencioso                                       | `packages/storage-sqlite/src/migrations/006_tag_colors.ts:16`          |
| Low | bug             | Parser de frontmatter ingenuo y YAML de export sin escapar                                                 | `packages/storage-core/src/data/Export.ts:86`                          |
| Low | bug             | `AnthropicProvider.validate()` nunca verifica la clave — siempre `ok`                                      | `packages/ai-core/src/providers/anthropic.ts:235`                      |
| Low | gap             | `buildContext` inyecta cuerpos completos sin chunking ni scoring                                           | `packages/ai-core/src/context-builder.ts:135`                          |
| Low | tech-debt       | Bloque de parsing del buffer final SSE duplicado                                                           | `packages/ai-core/src/providers/sse-parser.ts:55`                      |
| Low | gap             | Contenido de imagen degradado al literal `[image]` en todos los providers                                  | `packages/ai-core/src/providers/anthropic.ts:63`                       |
| Low | bug             | `SyncEngine.queueChange()` escribe a una cola que `push` nunca drena                                       | `packages/sync-core/src/engine.ts:207`                                 |
| Low | bug             | Webhook de Stripe sin idempotencia; pierde suscripciones si se pierde el evento de checkout                | `packages/api/src/routes/subscription.ts:67`                           |
| Low | bug             | Verificación de magic-link no atómica — token replicable por requests concurrentes                         | `packages/api/src/routes/auth.ts:83`                                   |
| Low | bug             | `JSON.parse` sin manejar sobre datos del cliente lanza 500 en vez de 422                                   | `packages/api/src/routes/sync.ts:276`                                  |
| Low | bug             | Detección de conflictos de keybinding ignora contexto `global`; dispatch no determinista                   | `packages/command-registry/src/registry.ts:126`                        |
| Low | gap             | `CommandRegistry.dispatch` hace `await execute()` sin manejo de errores                                    | `packages/command-registry/src/registry.ts:70`                         |
| Low | bug             | Título de nota MCP se extrae del primer heading en cualquier parte del doc                                 | `packages/mcp-server/src/index.ts:174`                                 |
| Low | gap             | `create_note` MCP archiva silenciosamente en Inbox si el notebook no existe                                | `packages/mcp-server/src/index.ts:181`                                 |
| Low | hardcoded       | Versión del servidor MCP hardcodeada a 0.1.0                                                               | `packages/mcp-server/src/index.ts:52`                                  |
| Low | tech-debt       | `extractWikilinks` no resetea `lastIndex` del regex global compartido                                      | `packages/wikilinks/src/core/parsing.ts:47`                            |
| Low | tech-debt       | `DataAPI.getTags` trae todos los tags y filtra/pagina en cliente                                           | `packages/plugin-api/src/data/createDataAPI.ts:128`                    |

---

## Plan de remediación por fases

> Convención: cada fase = uno o varios PRs siguiendo el Git Flow del proyecto (`fix/*` o `feature/*` → `develop` vía PR). Esfuerzo: S (≤1 día), M (2-3 días), L (>3 días, dividir en PRs incrementales por capa). "Desbloquea KB" indica si es prerequisito o habilitador directo del segundo API.

### Fase 0 — Seguridad crítica y superficie que el KB heredará

**Objetivo:** cerrar los vectores explotables antes de duplicar patrones (auth bearer, secretos, SSRF) en los futuros endpoints del KB.

| Hallazgo                       | Acción                                                                                                                                                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `admin.ts:48` (Critical)       | Verificar el JWT con `jose.jwtVerify(jwt, secret, {algorithms:['HS256']})` reutilizando `middleware/auth.ts` antes de leer el claim `email`.                                                                                    |
| `localServer.ts:148` (High)    | Comparar longitudes de **bytes** (`Buffer.from`) no de string; envolver el chequeo de auth dentro del try/catch para que un throw devuelva 401/500 y no cuelgue el socket.                                                      |
| `ipc-ai.ts:37` (Med, security) | `ai:chat` debe resolver la clave server-side vía `aiKeyStorage.getKey(provider)`; dejar de aceptar `apiKey` del renderer; limitar/eliminar `ai:getKey`. **Establece el patrón de secretos que reusará la clave de embeddings.** |
| `index.ts:632` (Med, SSRF)     | Envolver `editor:fetchUrlTitle` en `defineIpcHandler` con schema Zod; bloquear rangos privados/loopback/link-local y puertos no estándar.                                                                                       |
| `tokenStorage.ts:72` (Med)     | Espejar `aiKeyStorage`: comprobar `safeStorage.isEncryptionAvailable()` y lanzar error tipado (dejando el archivo) en vez de borrar ante "encryption unavailable".                                                              |

- **Archivos:** los de arriba + `apps/desktop/src/main/handlers/aiKeyHandlers.ts`, `apps/desktop/src/main/services/aiKeyStorage.ts`.
- **Esfuerzo:** M.
- **Desbloquea KB:** Sí (patrón de auth bearer del servidor local + patrón de secretos para el proveedor de embeddings).

### Fase 1 — Fiabilidad del panel de IA y del streaming

**Objetivo:** el chat de "preguntar a las notas" (RAG) comparte este panel y este listener; hay que eliminar el lockup y las fugas antes de montar RAG encima.

| Hallazgo                 | Acción                                                                                                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AiPanel.tsx:375` (High) | En el `catch` del flujo de comando poner `commandActiveRef.current = false`; idealmente resetear en un `finally`.                                                           |
| `AiPanel.tsx:290` (Med)  | El `useEffect` debe capturar y devolver el cleanup; guardar contra updates tras unmount. Mejor: reusar el listener persistente único con una tabla de dispatch por request. |
| `AiPanel.tsx:424` (Low)  | Sembrar `existingIds` con `currentNote.id` antes del primer loop para no duplicar la nota actual.                                                                           |
| `AiMessage.tsx:13` (Low) | Renderizar mensajes de IA a través de `MarkdownPreview` (con `rehype-sanitize`), borrando el parser regex casero — links/tablas/citas de RAG se renderizarán bien.          |

- **Archivos:** `apps/desktop/src/renderer/components/ai/AiPanel.tsx`, `AiMessage.tsx`.
- **Esfuerzo:** M.
- **Desbloquea KB:** Sí (la UI de ask-notes es el consumidor final del RAG).

### Fase 2 — Correctitud de `ai-core` (presupuesto de tokens, tool-loop, retry)

**Objetivo:** RAG-sobre-tools es la ruta primaria una vez exista un tool de KB; hoy esa ruta desborda contexto en silencio, no reintenta y está rota en Ollama.

| Hallazgo                      | Acción                                                                                                                                                                                                     |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `context-builder.ts:42` (Med) | Contar `tool_use.input` (JSON) y `tool_result.content` en `estimateMessageTokens`; aplicar presupuesto corriente dentro de `runToolLoop` (truncar/descartar resultados viejos al exceder `contextWindow`). |
| `ollama.ts:241` (Med)         | Rastrear con un flag local si se emitió algún `tool_call` durante todo el stream y usarlo para emitir `tool_use` en `done`. Sin esto, RAG-vía-tools está **muerto en el proveedor offline-first**.         |
| `ai-service.ts:138` (Med)     | Aplicar `withRetry` alrededor de cada `provider.chat` dentro de `runToolLoop` (por round-trip).                                                                                                            |
| `ai-service.ts:113` (Med)     | Extraer `DEFAULT_CONTEXT_WINDOW` por proveedor (o fail-closed a 8192) en vez del literal 200_000 duplicado.                                                                                                |
| `ai-service.ts:126` (Med)     | Pasar el query a `buildContext` (o reservar `estimateTokens(query)`) antes de empaquetar.                                                                                                                  |
| `anthropic.ts:235` (Low)      | `validate()` debe hacer una request autenticada ligera y mapear 401 → `{ok:false}`, como OpenAI/Ollama.                                                                                                    |
| `sse-parser.ts:55` (Low)      | Extraer `parseEventBlock()` y llamarlo desde el loop y desde el buffer final.                                                                                                                              |

- **Archivos:** `packages/ai-core/src/context-builder.ts`, `tool-loop.ts`, `ai-service.ts`, `providers/ollama.ts`, `providers/anthropic.ts`, `providers/sse-parser.ts`.
- **Esfuerzo:** M–L.
- **Desbloquea KB:** Sí (el tool de KB devuelve texto de notas como `tool_result`; ese es exactamente el contenido que hoy se subcuenta y desborda).

### Fase 3 — Consolidar la recuperación y limpiar las señales del grafo (Fase 0 del assessment)

**Objetivo:** unificar la lógica de recuperación en un único módulo `Retriever` testeable y limpiar el grafo de links/tags que RAG usará como señal de expansión de contexto. **Sin nuevas dependencias — refactor puro.**

| Hallazgo                                             | Acción                                                                                                                                                                                                                             |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `built-in-tools.ts:25` + `AiPanel.tsx:445-477` (Med) | Extraer la recuperación fuera del componente React a un módulo `Retriever` (`retrieve(query, {topK, mode})`) en `ai-core`/`core`; hacer que `search_notes` (tool) y `notes:search` llamen al mismo código. Única fuente de verdad. |
| `parsing.ts:19` (Med)                                | Cambiar el patrón core a `/(?<!!)\[\[.../` para excluir embeds `![[...]]`; **compartir UNA constante** de patrón entre core y el adaptador remark.                                                                                 |
| `SQLiteNoteRepository.ts:480` (Med)                  | Añadir `AND n.is_deleted = 0` a `getBacklinks`/`getOutgoingLinks`/`getGraphData`, igualando la exclusión de FTS.                                                                                                                   |
| `metadata.ts:53` (Med)                               | Stripear bloques de código (fenced + inline) antes de matchear `#tag`, reusando los pasos de `countWords()`.                                                                                                                       |
| `index.ts:589` (Low)                                 | Poblar `noteCount` desde `getWithMetadata` en vez del literal 0.                                                                                                                                                                   |
| `parsing.ts:47` (Low)                                | Resetear `WIKILINK_PATTERN.lastIndex = 0` al inicio del loop.                                                                                                                                                                      |

- **Archivos:** `apps/desktop/src/main/ai/built-in-tools.ts`, `apps/desktop/src/main/index.ts`, `AiPanel.tsx`, `packages/wikilinks/src/core/parsing.ts`, `packages/storage-sqlite/src/repositories/SQLiteNoteRepository.ts`, `packages/core/src/domain/metadata.ts`.
- **Esfuerzo:** M.
- **Desbloquea KB:** Sí — **crítico**. Define la abstracción `Retriever` sobre la que se enchufa el vector search, y garantiza un grafo limpio antes de usarlo como señal de recuperación.

### Fase 4 — Abstracción `EmbeddingProvider`

**Objetivo:** modelar embeddings de forma provider-agnóstica, espejando `LLMProvider`/`ProviderRegistry`.

- **Acción:** añadir en `ai-core` una interfaz `EmbeddingProvider { id; embed(texts, config): Promise<number[][]>; dimensions(model); validate(config); listModels(config) }` y un `EmbeddingRegistry` análogo a `ProviderRegistry`. Reusar el `FetchFn` inyectado (`provider.ts:6-20`) para mantener `ai-core` **sin SDKs** (regla CLAUDE.md). Implementar `OllamaEmbeddingProvider` (`/api/embeddings`, default offline) + un proveedor cloud opt-in (OpenAI `text-embedding-3-*` / Voyage). Nota: **Anthropic no tiene endpoint de embeddings**, así que el "segundo API" de embeddings no puede ser Anthropic.
- **Archivos:** `packages/ai-core/src/provider.ts`, `provider-registry.ts`, `providers/*-embedding.ts` (nuevos); `apps/desktop/src/main/ai/setup.ts` (registrar); clave vía `aiKeyHandlers.ts` (patrón ya asegurado en Fase 0).
- **Esfuerzo:** M.
- **Desbloquea KB:** Sí — abstracción central.

### Fase 5 — Almacenamiento + chunking

**Objetivo:** esquema para pasajes y vectores + chunker markdown-aware puro.

- **Acción:**
  - Migración `018_embeddings`: tabla `chunks (id, note_id, chunk_index, content, token_count, content_hash, updated_at)` + columnas `embedding BLOB` (Float32Array), `dim`, `model`. Guardar `model`+`dim` por fila para disparar reindex al cambiar el modelo.
  - `ChunkRepository` en `storage-sqlite` (implementando una nueva interfaz `RetrievalRepository`/`ChunkRepository` en `storage-core` — ver también hallazgo `SQLiteNoteRepository.ts:230`).
  - Chunker markdown-aware en `packages/core` (puro, con tests — regla "Test first"; nunca muta el markdown del usuario — regla "Markdown is sacred"). Split por headings/párrafos con solape.
  - **Corregir primero el orden de migraciones** (`016_tag_sync_tracking.ts:11`, `004_note_fields`) y añadir assertion de que `allMigrations` == orden por versión, para que `018` aterrice de forma predecible.
- **Archivos:** `packages/storage-sqlite/src/migrations/018_embeddings.ts` (nuevo), `packages/storage-sqlite/src/repositories/ChunkRepository.ts` (nuevo), `packages/storage-core/src/repositories/*` (nueva interfaz), `packages/core/src/` (chunker), `packages/storage-sqlite/src/migrations/runner.ts` (assertion).
- **Esfuerzo:** L.
- **Desbloquea KB:** Sí — fundacional (esquema + granularidad de pasaje).

### Fase 6 — Pipeline de indexación asíncrono

**Objetivo:** generar/actualizar embeddings fuera de banda (los triggers FTS son SQL síncrono y **no pueden** llamar a un API async).

- **Acción:** cola de trabajos en el proceso main (reusar el patrón de `packages/sync-core/src/queue.ts`): al crear/actualizar una nota → chunk → embeber chunks cambiados (saltar sin cambios vía `content_hash`) → upsert. Job de backfill para notas existentes con progreso vía IPC. Reindex al cambiar modelo/dim. Idealmente que la escritura de nota + índice participen de **una transacción** (relaciona con `SQLiteNoteRepository.ts:64`, `save()` no atómico): exponer `saveWithDerived(note)`.
- **Archivos:** `apps/desktop/src/main/ai/indexer/*` (nuevo), `apps/desktop/src/main/services/*`, `SQLiteNoteRepository.ts` (`saveWithDerived`).
- **Esfuerzo:** L.
- **Desbloquea KB:** Sí — único subsistema genuinamente nuevo.

### Fase 7 — Retriever híbrido + `ContextBuilder` consciente de chunks + IPC/Settings

**Objetivo:** entregar el "AI sobre tus notas": recuperación semántica + fusión con bm25 + contexto con citas.

| Hallazgo                                                 | Acción                                                                                                                                                                                                                                                            |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `context-builder.ts:135` (Low) + `NoteContext` (`:8-12`) | Extender `NoteContext` para llevar chunks + offsets + `score` + citas; empaquetar por score, no all-or-nothing por nota.                                                                                                                                          |
| `schema.ts:64` (Low) + preload AI API                    | Extender `AiSettings` con sub-config de embeddings (provider, model, dimensions, `ollamaBaseUrl`) tras un bump de `SETTINGS_VERSION`; añadir namespace `kb`/`embeddings` al preload (canales `kb:index/status/reindex`, `kb:search`, `embed`, validados con Zod). |
| `AiSection.tsx:47` (Med) + `:42` (Med)                   | Añadir `ai.models(provider)` IPC (usa `LLMProvider.models()`), y setting `ollamaBaseUrl` con input; reusar el mismo mecanismo para el picker de modelo de embeddings.                                                                                             |
| `AiPanel.tsx:477` (Low)                                  | Exponer `maxResponseTokens` en `AiSettings` (RAG sintetiza varios chunks y hoy trunca en 2048).                                                                                                                                                                   |

- **Acción de recuperación:** `query → embed → top-k coseno (brute-force JS/SQL primero; `sqlite-vec`**solo si** la performance lo exige y **solo en`apps/desktop`**) → fusión con FTS bm25 vía reciprocal-rank fusion → chunks con refs`. Apuntar el modo ask-notes al retriever y exponer un tool `semantic_search` junto a `search_notes`. Respetar el cap de `ChatRequestSchema` (`ipc-ai.ts:25`: `relevantNotes` ≤200, 1 MB/campo) — los chunks caben, los cuerpos completos no.
- **Archivos:** `packages/ai-core/src/context-builder.ts`, `apps/desktop/src/main/ai/ipc-ai.ts`, `built-in-tools.ts`, `apps/desktop/src/preload/api/ai.ts`, `apps/desktop/src/renderer/stores/settings/schema.ts`, `AiSection.tsx`, `AiPanel.tsx`.
- **Esfuerzo:** L.
- **Desbloquea KB:** Sí — entrega el objetivo.

### Fase 8 — Deuda técnica, hardening de backend y limpieza (paralelizable)

**Objetivo:** saldar items no bloqueantes; algunos endurecen patrones que el KB reusará (JSON safe-parse, rate limit, client de red).

Ver detalle en "Deuda técnica y limpieza". Se puede intercalar con las fases anteriores mediante PRs pequeños e independientes por capa.

- **Esfuerzo:** M (repartido en muchos PRs S).
- **Desbloquea KB:** Parcialmente (safe-parse JSON, timeouts de `ApiClient`, config central de endpoints y `net.fetch` benefician al futuro client del proveedor de embeddings cloud).

---

## Camino al knowledge base (segundo API)

Arquitectura incremental concreta, conforme a las reglas del proyecto (offline-first, core puro, deps nativas solo en `apps/desktop`).

### Estado actual (por qué no hay base sobre la que construir)

- `ContextBuilder` (`packages/ai-core/src/context-builder.ts:93-151`) es un **empaquetador de presupuesto de tokens puro**: recibe notas ya seleccionadas y las concatena hasta llenar el budget. Estimador ingenuo `Math.ceil(text.length/4)` (`:37-40`). `NoteContext` es `{id,title,content}` (`:8-12`) — **granularidad de nota completa, sin modelo de chunk/offset/cita**.
- Dos rutas de "recuperación" divergentes, ambas por keyword: manual en el renderer (`AiPanel.tsx:445-477`) y tool `search_notes` (`built-in-tools.ts:25-41` cableado en `index.ts:609`). Sin embeddings en ningún lado.
- Almacenamiento: tabla `notes` (`migrations/001_initial_schema.ts:14-21`); FTS5 `notes_fts(id UNINDEXED, title, content)` con triggers (`migrations/008_fts5_index.ts:20-54`); búsqueda `bm25` en `SQLiteNoteRepository.ts:164-195`; `prepareFtsQuery` hace OR de términos (`noteMapping.ts:105-110`). Última migración: `017`. **Sin tabla de vectores ni chunks.**
- API en la nube `packages/api` = Cloudflare Worker de sync/cuenta, **E2E cifrado** (`routes/sync.ts:5,96,109,185`): el servidor solo ve `encryptedData`. **No puede leer texto de notas.**

### Pasos (ver Fases 3–7 para el desglose en PRs)

1. **Consolidar `Retriever`** (Fase 3): sacar la recuperación de `AiPanel.tsx` y del tool a un módulo único en `ai-core`/`core`. Sin esto, cada cambio posterior pelea con el acoplamiento a la UI.
2. **`EmbeddingProvider` + `EmbeddingRegistry`** (Fase 4) en `ai-core`, espejando `LLMProvider`/`ProviderRegistry`, con `FetchFn` inyectado. `OllamaEmbeddingProvider` (default offline) + cloud opt-in.
3. **Esquema** (Fase 5): migración `018` con `chunks` + `embedding BLOB` + `dim` + `model` + `content_hash`; `ChunkRepository`; chunker markdown-aware puro en `packages/core`.
4. **Pipeline de indexación** (Fase 6): cola en main (patrón `sync-core/queue.ts`), incremental por `content_hash`, backfill con progreso IPC, reindex al cambiar modelo.
5. **Retriever híbrido + contexto con chunks** (Fase 7): coseno brute-force → RRF con bm25; `ContextBuilder`/`NoteContext` con chunks+citas; modo ask-notes apuntado al retriever; tool `semantic_search`; IPC `kb:*` validado con Zod; settings de embeddings.
6. **Nube opcional** (solo si se desea, mantener E2E): quedarse **local-only** por defecto. Si se añade un API de embeddings gestionado, hacerlo **servicio separado** y opt-in explícito — **no** montarlo sobre el worker de sync cifrado en `packages/api`.

### Archivos clave a tocar

- `packages/ai-core/src/provider.ts`, `provider-registry.ts` — abstracción de embeddings
- `packages/ai-core/src/context-builder.ts:8-12,93-151` — contexto consciente de chunks + citas
- `packages/core/src/` — chunker markdown-aware (puro, con tests)
- `packages/storage-sqlite/src/migrations/018_embeddings.ts` + `ChunkRepository` (+ interfaz en `storage-core`)
- `apps/desktop/src/main/ai/setup.ts`, `built-in-tools.ts`, `ipc-ai.ts` — registro de proveedor, IPC de indexación, tool semántico
- `apps/desktop/src/renderer/components/ai/AiPanel.tsx:445-477` — reemplazar recuperación FTS manual por el retriever
- `apps/desktop/src/main/handlers/aiKeyHandlers.ts` — reusar para clave de API de embeddings

---

## Deuda técnica y limpieza

Items no bloqueantes; agrupar en PRs pequeños por capa. Los marcados (KB) tocan patrones que el segundo API reusará.

**Main / desktop**

- `apiClient.ts:213` **(KB)** — añadir timeout/AbortSignal (`AbortSignal.timeout(ms)`); el patrón ya existe en `index.ts:640`. El futuro client de embeddings cloud debe compartir esta base.
- `index.ts:699` **(KB)** — registrar handlers IPC incondicionalmente (síncrono, antes del load); cada handler obtiene su servicio de forma lazy o devuelve "not ready". Los handlers `kb:*` deben registrarse igual.
- `apiClient.ts:10` **(KB)** — migrar a `net.fetch` inyectado (como hace `ai-core`), quitar `cross-fetch`; evitar un tercer estilo de red para el KB.
- `index.ts:720` **(KB)** — extraer `handleDeepLink(url)` único para las 3 rutas; centralizar base URLs (incluida la del backend `https://api.dripnex.app` y las de checkout/pricing) en un módulo de config. El KB añade su base URL ahí, no otro literal.
- `authSyncHandlers.ts:137` — devolver `{success: refreshed.type==='success', reason, error}`.
- `pluginHandlers.ts:419` — usar la misma clase de caracteres que install (`/[^a-zA-Z0-9_-]/`).
- `useAutoSave.ts:20` — flush síncrono / handshake `before-quit` para no perder ediciones al salir.
- `useNavigation.ts:1` — actualizar CLAUDE.md (tag/search implementados; corregir `.tsx`→`.ts`).

**Renderer / AI (hardcoded)**

- `AiPanel.tsx:275/400` + `schema.ts:154` — exportar `DEFAULT_MODEL` único.

**Domain / storage**

- `SQLiteNoteRepository.ts:230` **(KB)** — dividir en puertos en `storage-core` (`LinkRepository`, `TagRepository`, `SyncRepository`, futura `RetrievalRepository`); programar contra interfaces. Prerequisito para enchufar un proveedor de recuperación limpio.
- `008_fts5_index.ts:20` **(KB)** — el "contentless" es falso (duplica el contenido); documentar o pasar a external-content; introducir filas por chunk cuando se planifique retrieval de pasajes.
- `Export.ts:31` **(KB)** — llevar `notebookId/status/isPinned/isDeleted` en export/import; unificar los dos `NoteSnapshot` homónimos (`storage-core` vs `packages/core/contracts`).
- `SQLiteNoteRepository.ts:64` **(KB)** — `saveWithDerived()` atómico (nota + tags + links + futuro índice de embeddings en una transacción).
- `016_tag_sync_tracking.ts:11` + `004_note_fields` **(KB)** — corregir versiones para que el orden numérico == orden declarado; assertion al arranque. Necesario para que `018` aterrice de forma predecible.
- `006_tag_colors.ts:16` — quitar los `PRAGMA foreign_keys` (no-op dentro de transacción).
- `Export.ts:86` — usar un serializador/parser YAML vetado para frontmatter.

**ai-core**

- `anthropic.ts:63` **(KB)** — decidir: quitar `image` de `ContentPart` o implementar bloques de imagen reales (Anthropic/OpenAI vision). Notas con imágenes hoy no llegan al modelo.

**Backend (`packages/api` / sync-core)**

- `sync-core/engine.ts:85` (High) **(KB)** — resolver el código muerto: borrar `sync-core` (+ entry en `electron-vite.config.ts`) **o** migrar `SyncService` a consumirlo. Elegir una única fuente de verdad de client/transport antes de añadir un segundo API.
- `sync.ts:264` — importar `validateNotebookTree` de `@dripnex/sync-core` y borrar la copia inline.
- `sync-core/engine.ts:207` — drenar `queue.getPendingChanges()` en `pushChanges` o eliminar la ruta de cola.
- `rateLimit.ts:22` **(KB)** — respaldar con KV/Durable Objects; confiar solo en `CF-Connecting-IP`. Un endpoint de KB read-heavy es blanco de abuso; planear rate limit desde el inicio.
- `subscription.ts:67` — persistir event ids de Stripe (idempotencia) y hacer upsert de la suscripción.
- `auth.ts:83` — consumo atómico del magic-link (`UPDATE ... WHERE usedAt IS NULL RETURNING`).
- `sync.ts:276/387/557` + `plugins.ts:78/102` **(KB)** — helper `safeParse` que devuelve 422; el endpoint de ingest del KB recibirá blobs JMON similares.
- `auth.ts:140` + `subscription.ts:322` — trial desde config compartida, no `14` hardcodeado.
- `share.ts:49` — rate limit en rutas públicas; aumentar entropía del slug (≥16 chars).

**Extensiones / MCP / command-registry**

- `mcp-server/index.ts:161` (Med) **(KB)** — las escrituras MCP saltan IPC/Zod y dejan la app stale; enrutar por IPC/dominio o emitir señal de cambio de DB que el desktop suscriba e invalide caches. El KB será un segundo lector/escritor sobre la misma DB: la disciplina de single-writer + notificación decidida aquí gobierna la consistencia del índice.
- `mcp-server/index.ts:174` **(KB)** — anclar el título al primer heading del tope del documento, alineado con la app. Títulos inconsistentes ensucian el índice del KB.
- `mcp-server/index.ts:181` — devolver error/aviso si el notebook no resuelve en vez de caer a Inbox silenciosamente.
- `mcp-server/index.ts:52` — leer versión de `package.json`.
- `command-registry/registry.ts:126` — tratar bindings `global` como conflictivos con cualquier contexto que comparta el chord.
- `command-registry/registry.ts:70` — envolver `execute()` en try/catch, loguear y devolver `false`.
- `createDataAPI.ts:128` — empujar `filter/limit/offset` al SQL o documentar que es in-memory.

---

## Riesgos y decisiones abiertas

1. **E2E vs "API de KB en la nube" (la tensión mayor).** El sync actual solo ve ciphertext (`routes/sync.ts:5`). Un RAG server-side exigiría enviar **texto plano** a un backend nuevo (rompe el modelo E2E) o embeddings en cliente con subida de vectores cifrados (los vectores igual filtran semántica). **Decisión recomendada:** el KB es un **índice local**; cualquier pieza cloud es solo el **generador de embeddings**, opt-in explícito, como servicio separado — nunca sobre el worker de sync. Requiere confirmación del owner porque reencuadra su framing de "conectar un segundo API".

2. **Embeddings offline vs cloud (regla dura: offline-first).** La búsqueda vectorial es 100% local una vez indexado; el único paso que toca red es _generar_ embeddings. Por "ninguna feature requiere internet", el **default debe ser local (Ollama / modelo embebido)** y el cloud (OpenAI/Voyage/Cohere) un realce opt-in. Anthropic **no** ofrece embeddings, así que el "segundo API" no puede ser Anthropic.

3. **Almacenamiento vectorial: brute-force JS vs `sqlite-vec`.** Recomendado empezar con coseno brute-force en JS/SQL (suficiente para corpus personales de miles de chunks) y añadir `sqlite-vec` **solo si** la performance lo exige. `sqlite-vec` es dependencia **nativa** → **solo en `apps/desktop`** (CLAUDE.md), nunca en un workspace package; los packages quedan TS puro con peerDeps.

4. **Runtime del MCP server (Node 20 vs 24) y contención de escritores.** `mcp-server` usa `node:sqlite`/WAL sobre el mismo `dripnex.db` que la app abre con `better-sqlite3` (`index.ts:161`). Dos escritores sobre el mismo archivo + el KB como tercer lector/escritor requieren decidir la disciplina de single-writer y notificación de cambios antes de indexar. Verificar también compatibilidad de la versión de Node del MCP con `node:sqlite`.

5. **Migración de settings.** Añadir sub-config de embeddings exige bump de `SETTINGS_VERSION` con migración (`schema.ts:64`). Coordinar con cualquier otro cambio de settings en vuelo para no colisionar versiones.

6. **Presupuesto de tokens y modelos no-Anthropic.** Hasta cerrar Fase 2 (`ai-service.ts:113` 200k fallback, `context-builder.ts:42` tool tokens a 0), empaquetar muchos chunks para RAG **desbordará** en modelos con ventana <200k (p. ej. Ollama 4k). Fase 2 es prerequisito de Fase 7.

7. **Reindexado y coste.** Cambiar el modelo/dim de embeddings obliga a reindexar todo el corpus (guardar `model`+`dim` por fila lo permite detectar). Definir política de reindex (automático vs manual con progreso IPC) y, para proveedores cloud, el coste/rate-limit del backfill inicial.

8. **Orden de migraciones antes de `018`.** El bug de ordenamiento (`016_tag_sync_tracking.ts:11`) debe corregirse **antes** de introducir `018_embeddings`, o la nueva migración podría aterrizar en un orden impredecible respecto al esquema de notas/tags del que depende.
