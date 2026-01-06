# Architecture Audit — Readied Markdown Note App

> Last verified: 2026-01-06

## 1. Estado Actual (Enero 2026)

La arquitectura ha evolucionado significativamente. Muchos problemas identificados originalmente ya fueron resueltos:

| Problema Original                   | Estado        | Solución                                  |
| ----------------------------------- | ------------- | ----------------------------------------- |
| Preview muestra datos stale         | **RESUELTO**  | `editorBufferStore` provee buffer en vivo |
| Core vs renderer borroso            | **NO EXISTE** | Separación correcta en packages           |
| Debounce no cancela al cambiar nota | **RESUELTO**  | Fix en NoteEditor.tsx                     |
| Pipeline markdown fragmentado       | **PARCIAL**   | Cada package tiene su parser              |

## 2. Arquitectura Actual

### 2.1 Flujo de Datos del Editor

```
CodeMirror EditorState
       ↓ (updateListener)
editorBufferStore.liveContent  ←──── Fuente de verdad para UI
       ↓
MarkdownPreview (usa buffer vivo)
       ↓
react-markdown (render)
```

```
CodeMirror EditorState
       ↓ (updateListener, 500ms debounce)
onUpdate() → App.tsx → IPC → SQLite
       ↓
React Query cache invalidation
```

### 2.2 Separación de Capas

**Core (packages/core):**

- Operaciones de dominio puras
- Sin dependencias Electron/React
- Tests completos

**Packages satélite:**

- `@readied/wikilinks`: Parseo y plugins
- `@readied/embeds`: Parseo de `![[file]]`
- `@readied/tasks`: Conteo de tasks
- `@readied/commands`: Formateo markdown

**Storage:**

- `storage-core`: Interfaces puras
- `storage-sqlite`: Implementación con native deps

**Renderer:**

- Hooks son bindings a IPC, no lógica
- Stores Zustand para estado de UI
- No hay lógica de negocio

## 3. Decisiones Acertadas

1. **Markdown como fuente de verdad** - Nunca se serializa desde AST
2. **Buffer store separado** - `editorBufferStore` desacopla editor de persistencia
3. **Plugins con contratos claros** - `createWikilinkPlugin(resolver)` es una buena API
4. **IPC tipado** - Preload expone API con tipos explícitos

## 4. Áreas de Mejora Potencial

### 4.1 Embeds resueltos del contenido guardado (edge case)

- `useEmbedResolver` usa `note?.content` (guardado)
- Si se agrega un embed nuevo, no se resuelve hasta guardar
- **Impacto:** Bajo, solo afecta embeds recién agregados

### 4.2 Centralización de parseo (futuro)

- Cada package parsea independientemente
- Podría beneficiarse de un pipeline unificado
- **Prioridad:** Baja, funciona correctamente

## 5. Invariantes del Sistema

1. **Markdown es sagrado** - Nunca auto-modificar texto del usuario
2. **AST es efímero** - Parsear para features, nunca persistir como autoridad
3. **Core es puro** - Sin deps Electron/React
4. **Offline-first** - No features requieren internet

## 6. Conclusión

La arquitectura es sólida. La separación core/adapters se respeta.
El `editorBufferStore` resolvió el problema principal de preview stale.
No hay deuda técnica crítica que bloquee nuevas features.
