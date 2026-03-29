# Phase 2 Completion Design (2.4 + 2.6)

## Goal

Close the remaining gaps in Phase 2 (Plugin System) — fix the pluginScanner type bug, add config value validation, and build a dev-mode Plugin Inspector.

## What Already Exists

### 2.4 Plugin Config Auto-Generated UI (90% done)

- `PluginConfigSchemaField` in `plugin-api/src/types.ts` supports all 5 types: string, number, boolean, enum, range
- UI controls in `controls.tsx`: Toggle, TextInput, NumberInput, RangeInput, Select
- Auto-generated form in `PluginsSection.tsx` renders all field types, persists via IPC
- Config storage in SQLite (`plugin_config` table)
- Built-in examples: focusMode (boolean), aiAssistant (enum + range)

### 2.6 Plugin Hot Reload (80% done)

- `pluginWatcher.ts`: fs.watch with 300ms debounce, dev-mode only
- IPC broadcast `plugins:reload` to all windows on file change
- `pluginRuntimeStore.ts` handles reload by re-scanning filesystem
- Dev mode detection via `process.env.NODE_ENV === 'development'`

## What's Needed

### 2.4a — Fix pluginScanner type bug

`pluginScanner.ts` defines its own `PluginConfigSchemaField` with only `string | number | boolean`. Missing `enum` and `range` types plus their metadata fields (`options`, `min`, `max`, `step`). Community plugins with enum/range configs would have their schema silently narrowed.

**Fix:** Update the type to match `plugin-api/src/types.ts`.

### 2.4b — Config value validation

No validation exists when config values are saved. The UI controls provide soft constraints (HTML min/max, select options), but nothing prevents invalid values from reaching storage if a plugin bypasses the UI or data is corrupted.

**Fix:** Add `validateConfigValue(field, value)` to `plugin-api/src/validation.ts`. Hook into `handleConfigChange` in `PluginsSection.tsx` as a safety net. Reject with console warning (no UI error needed — controls already constrain input).

Validation rules:

- boolean: `typeof value === 'boolean'`
- string: `typeof value === 'string'`
- number: `typeof value === 'number'` + optional min/max bounds
- enum: value exists in `field.options`
- range: `typeof value === 'number'` + min/max bounds

### 2.6 — Plugin Inspector (dev mode only)

A collapsible section in Settings > Plugins, visible only in dev mode. Shows:

- Loaded plugins with status badges (active/error/disabled)
- Error details for failed plugins
- "Force Reload All" button (wired to existing `plugins:requestReload` IPC)
- Load time per plugin

**Not building (YAGNI):** real-time log streaming, per-plugin reload, memory profiling, console interception, separate dev tools window.

## Architecture

No new stores or IPC channels needed. All changes build on existing infrastructure:

- Validation function is pure (no side effects), testable in isolation
- Plugin Inspector reads from existing `pluginRuntimeStore` (plugins, errors)
- Load timing added as metadata in `pluginRuntimeStore` during scan
- Dev mode check uses existing `window.readied.isDevelopment` flag

## Not Included

- Config value sync across devices (future — post sync hardening)
- Advanced schema features (regex patterns, dependent fields, multiselect)
- Plugin permissions/sandboxing (Phase 5)
- Per-plugin crash counter and auto-disable (already covered by error isolation in 2.5)
