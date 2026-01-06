# React + CSS Architecture Audit (Desktop Markdown App)

> Last verified: 2026-01-06

## 1. Estado Actual (Enero 2026)

La arquitectura React ha mejorado significativamente con la introducción de `editorBufferStore`:

| Problema Original | Estado | Solución |
|-------------------|--------|----------|
| Preview no reactivo al buffer | **RESUELTO** | `selectContentForNote` selector |
| Múltiples fuentes de verdad | **MITIGADO** | Buffer store es fuente de UI |
| Efectos no cancelables | **RESUELTO** | Debounce se cancela en cambio de nota |
| Componentes como servicios | **PARCIAL** | NoteEditor aún orquesta, pero mejor |

## 2. Arquitectura de Estado

### 2.1 Fuentes de Verdad

```
┌─────────────────────────────────────────────────────────┐
│                    Editor Flow                          │
├─────────────────────────────────────────────────────────┤
│  CodeMirror State                                       │
│       ↓                                                 │
│  editorBufferStore.liveContent  ← UI Source of Truth   │
│       ↓                                                 │
│  MarkdownPreview (via selectContentForNote)            │
├─────────────────────────────────────────────────────────┤
│                  Persistence Flow                       │
├─────────────────────────────────────────────────────────┤
│  debounce (500ms) → onUpdate → IPC → SQLite            │
│       ↓                                                 │
│  React Query cache (invalidate on success)             │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Stores Zustand

- `editorBufferStore`: Buffer vivo del editor
- `editorPreferencesStore`: Preferencias de UI
- `performanceStore`: Flags de performance
- `navigationStore`: Estado de navegación

### 2.3 React Query

- Usado para CRUD contra IPC
- Cache invalidation automática
- No es fuente de verdad para el buffer (eso es Zustand)

## 3. Decisiones Correctas

1. **Buffer separado de persistencia** - Escribir es inmediato, guardar es debounced
2. **Preview usa buffer store** - No hay lag entre escribir y ver
3. **Hooks son bindings** - No contienen lógica de negocio
4. **Cancelación de efectos** - Debounce se limpia al cambiar nota

## 4. CSS Architecture

### 4.1 Sistema de Tokens
- `styles/tokens.css`: Variables CSS centralizadas
- Escala de espaciado, colores, tipografía
- Temas via atributos en `:root`

### 4.2 Módulos CSS
- Componentes usan `.module.css`
- Evita conflictos de nombres
- Scoped por defecto

### 4.3 Estilos Globales
- `global.css`: Reset y utilities
- Markdown preview tiene estilos globales (necesario para react-markdown)

## 5. Áreas de Mejora Potencial

### 5.1 NoteEditor como orquestador
- Aún maneja bastante estado (debounce, scroll sync, embeds)
- Podría beneficiarse de más extracción a hooks
- **Prioridad:** Baja, funciona correctamente

### 5.2 Atajos globales
- `useKeyboardShortcuts` usa listeners globales
- Podrían centralizarse más
- **Impacto:** Bajo

## 6. Contratos Estables

### 6.1 Scroll Sync
- `MarkdownPreviewHandle`: getScrollFraction, setScrollFraction, onScroll, canScroll
- `MarkdownEditorHandle`: mismo contrato
- Master-slave pattern evita loops

### 6.2 Editor Buffer
- `EditorBufferStore`: noteId, liveContent, isDirty
- Selector: `selectContentForNote(noteId)` - null-safe

## 7. Conclusión

La arquitectura React es funcional y mantenible.
El `editorBufferStore` resuelve el problema principal de reactividad.
Los hooks son simples bindings a IPC sin lógica de negocio.
No hay deuda técnica crítica que requiera refactoring urgente.
